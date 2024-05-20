import { Flags } from "@oclif/core";
import { ExitError } from "@oclif/core/lib/errors/index.js";
import chalk from "chalk";
import {
  Issue,
  IssueTransition,
  PageProject,
} from "jira.js/out/version3/models/index.js";
import { format } from "node:util";
import { AuthCommand } from "../AuthCommand.js";
import { ActionSequenceState } from "../actions/index.js";
import { GitService, errors } from "../services/git/index.js";
import { JiraService, StatusCategory } from "../services/jira/index.js";
import {
  chooseCheckbox,
  chooseChoice,
  chooseProject,
  chooseTransition,
} from "../ux/prompts/index.js";

export default class Ready extends AuthCommand {
  static override summary = "Mark an issue as ready for review";

  static override flags = {
    undo: Flags.boolean({
      char: "u",
      description:
        "Mark the pull request as a draft and transition the issue to its working status",
    }),
  };

  async run() {
    const { flags } = await this.parse(Ready);

    this.spinner.start();

    const [jira, git] = await Promise.all([
      this.initJiraService(),
      this.initGitService(),
    ]);

    const shouldUndo = flags.undo;

    if (!shouldUndo) {
      this.log(chalk.dim("(Use --undo flag to undo this action)"));
    }

    const projectKey = await this.resolveProjectKey(jira);

    await this.handlePullRequestExistance(git);

    const issue = await this.resolveIssue(jira, git, projectKey);

    const transition = issue
      ? await this.resolveIssueTransition(jira, shouldUndo, issue)
      : undefined;

    const reviewers = await this.resolveReviewers(git, shouldUndo);

    const sequencer = this.getSequencer(jira, git, shouldUndo);

    this.log();
    await sequencer.run({ issue, transition, reviewers });
    this.log();

    await this.handleWhatsNext(jira, git, issue);

    this.log();
  }

  private async handleWhatsNext(
    jira: JiraService,
    git: GitService,
    issue?: Issue
  ) {
    enum Choice {
      Skip = "Skip",
      OpenPullRequest = "Open pull request in browser",
      OpenIssue = "Open issue in browser",
      OpenBoth = "Open issue and pull request in browser",
    }

    const choices = [Choice.Skip, Choice.OpenPullRequest];

    if (issue) {
      choices.push(Choice.OpenIssue);
      choices.push(Choice.OpenBoth);
    }

    const choice = await chooseChoice("What's next?", choices);

    const issueUrl = issue && jira.constructIssueUrl(issue);

    switch (choice) {
      case Choice.OpenPullRequest:
        this.open(await git.fetchPullRequestUrl());
        break;
      case Choice.OpenIssue:
        if (!issueUrl) throw new Error("Issue URL is not available.");
        this.open(issueUrl);
        break;
      case Choice.OpenBoth:
        this.open(await git.fetchPullRequestUrl());
        if (!issueUrl) throw new Error("Issue URL is not available.");
        this.open(issueUrl);
        break;
    }
  }

  private getSequencer(
    jira: JiraService,
    git: GitService,
    shouldUndo: boolean
  ) {
    const sequencer = this.initActionSequencer<{
      issue?: Issue;
      transition?: IssueTransition;
      reviewers: string[];
    }>();

    sequencer.add({
      titles: ({ issue, transition }) => ({
        [ActionSequenceState.Running]: format(
          "Transitioning %s to %s",
          chalk.cyan(issue!.key),
          chalk.cyan(transition!.name)
        ),
        [ActionSequenceState.Completed]: format(
          "Transitioned %s from %s to %s",
          chalk.cyan(issue!.key),
          chalk.cyan(issue!.fields.status.name),
          chalk.cyan(transition!.name)
        ),
        [ActionSequenceState.Failed]: format(
          "Could not transition %s to %s",
          chalk.cyan(issue!.key),
          chalk.cyan(transition!.name)
        ),
      }),
      ignoreWhen: ({ issue, transition }) => {
        return !issue || !transition;
      },
      action: async ({ issue, transition }, sequence) => {
        if (issue!.fields.status.name === transition!.name) {
          sequence.skip(
            format(
              "Skipped transition. %s is already in %s",
              chalk.cyan(issue!.key),
              chalk.cyan(transition!.name)
            )
          );
        }

        await jira.client.issues.doTransition({
          issueIdOrKey: issue!.key,
          transition,
        });
      },
    });

    if (shouldUndo) {
      sequencer.add({
        titles: () => ({
          [ActionSequenceState.Running]: "Marking pull request as draft",
          [ActionSequenceState.Completed]: "Marked pull request as draft",
          [ActionSequenceState.Failed]: "Could not mark pull request as draft",
        }),
        action: async (_, sequence) => {
          try {
            await git.markPullRequestAsDraft();
          } catch (error) {
            if (error instanceof errors.DraftPullRequestNotSupportedError) {
              sequence.skip(
                format(
                  "Skipped marking pull request as draft. %s",
                  error.message
                )
              );
            }

            throw error;
          }
        },
      });
    } else {
      sequencer.add({
        titles: () => ({
          [ActionSequenceState.Running]:
            "Marking pull request as ready for review",
          [ActionSequenceState.Completed]:
            "Marked pull request as ready for review",
          [ActionSequenceState.Failed]:
            "Could not mark pull request as ready for review",
        }),
        action: async () => {
          await git.markPullRequestAsReady();
        },
      });
    }

    if (shouldUndo) {
      return sequencer;
    }

    sequencer.add({
      titles: ({ reviewers }) => ({
        [ActionSequenceState.Running]: "Requesting reviewers for review",
        [ActionSequenceState.Completed]: format(
          "Requested %s for review",
          chalk.cyan(reviewers.join(", "))
        ),
        [ActionSequenceState.Failed]: "Could not request reviewers for review",
      }),
      action: async ({ reviewers }, sequence) => {
        if (reviewers.length === 0) {
          sequence.skip("No reviewers requested for review");
        }

        await git.addReviewers(reviewers);
      },
    });

    return sequencer;
  }

  private async resolveReviewers(git: GitService, shouldUndo: boolean) {
    if (shouldUndo) {
      return [];
    }

    const teamMembers = await git.listTeamMembers();

    let reviewers: string[] = [];

    if (teamMembers.length > 0) {
      reviewers = await chooseCheckbox(
        "Who should review this pull request?",
        teamMembers
      );
    }

    return reviewers;
  }

  private async resolveIssueTransition(
    jira: JiraService,
    shouldUndo: boolean,
    issue: Issue
  ): Promise<IssueTransition> {
    this.spinner.start();

    const { transitions } = await jira.client.issues.getTransitions({
      issueIdOrKey: issue.key,
    });

    this.spinner.stop();

    if (!transitions) {
      throw new Error("Could not fetch transitions");
    }

    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.to?.statusCategory?.key === StatusCategory.InProgress
    );

    const transitionStatus = shouldUndo
      ? this.config.saga.get("workingStatus")
      : this.config.saga.get("readyForReviewStatus");

    let transition: IssueTransition | null = null;

    if (transitionStatus) {
      transition =
        filteredTransitions.find(
          (transition) => transition.name === transitionStatus
        ) ?? null;
    }

    if (!transitionStatus) {
      this.log(chalk.yellow("!"), "No issue status found.");
    }

    if (transitionStatus && !transition) {
      this.log(
        chalk.yellow("!"),
        format(
          "The issue status %s is no longer available.",
          chalk.cyan(transitionStatus)
        )
      );
    }

    if (!transition) {
      transition = await chooseTransition(filteredTransitions);

      if (!transition.name) {
        throw new Error("Expected transition name to be defined");
      }

      if (shouldUndo) {
        this.config.saga.set("workingStatus", transition.name);
      } else {
        this.config.saga.set("readyForReviewStatus", transition.name);
      }
    }

    return transition;
  }

  private async handlePullRequestExistance(git: GitService) {
    const openPullRequestExists = await git.openPullRequestExists();

    if (!openPullRequestExists) {
      this.log(
        chalk.red("✗"),
        "Could not find an open pull request for the current branch"
      );

      throw new ExitError(1);
    }
  }

  private async resolveIssue(
    jira: JiraService,
    git: GitService,
    projectKey: string
  ) {
    const currentBranch = await git.getCurrentBranch();

    let issueKey = jira.extractIssueKey(projectKey, currentBranch);

    if (!issueKey) {
      const details = await git.fetchPullRequestDetails(currentBranch);
      issueKey = details && jira.extractIssueKey(projectKey, details.body);
    }

    let issue: Issue | null = null;

    if (issueKey) {
      issue = await jira.client.issues.getIssue({
        issueIdOrKey: issueKey,
      });
    }

    return issue ?? undefined;
  }

  private async resolveProjectKey(jira: JiraService): Promise<string> {
    let projectKey = this.config.saga.get("project");

    if (!projectKey) {
      this.spinner.start();

      const projects = await jira.fetchAllPages<PageProject["values"][number]>(
        (startAt) => {
          return jira.client.projects.searchProjects({
            maxResults: 100,
            startAt,
          });
        }
      );

      this.spinner.stop();

      if (projects.length === 0) {
        this.log("No projects found.");
        throw new ExitError(1);
      }

      if (projects.length === 1) {
        const project = projects[0];
        projectKey = project.key;

        this.log(
          chalk.yellow("!"),
          format(
            "Using %s as project since there are no other projects to choose from.",
            chalk.cyan(projectKey)
          )
        );
      } else {
        const project = await chooseProject(projects);
        projectKey = project.key;
      }
    }

    this.config.saga.set("project", projectKey);

    return projectKey;
  }
}
