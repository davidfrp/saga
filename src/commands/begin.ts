import { ExitError } from "@oclif/core/lib/errors/index.js";
import chalk from "chalk";
import doT from "dot";
import {
  Issue,
  IssueTransition,
  PageProject,
} from "jira.js/out/version3/models/index.js";
import { format } from "node:util";
import { AuthCommand } from "../AuthCommand.js";
import { ActionSequenceState } from "../actions/index.js";
import { DraftPullRequestNotSupportedError } from "../services/git/errors.js";
import { FlagOptions, GitService } from "../services/git/index.js";
import { JiraService, StatusCategory } from "../services/jira/index.js";
import {
  chooseAssignToMe,
  chooseBaseBranch,
  chooseBranch,
  chooseChoice,
  chooseIssue,
  choosePrTitle,
  chooseProject,
  chooseStartingPoint,
  chooseTransition,
} from "../ux/prompts/index.js";

export default class Begin extends AuthCommand {
  static override summary = "Begin work on an issue";

  static override args = {};

  static override flags = {};

  async run() {
    this.spinner.start();

    const [jira, git] = await Promise.all([
      this.initJiraService(),
      this.initGitService(),
    ]);

    const projectKey = await this.resolveProjectKey(jira);

    const issue = await this.resolveIssue(jira, projectKey);

    await this.handleIssueLinkedToBranch(jira, issue);

    const shouldAssignToMe = await this.resolveShouldAssignToMe(
      issue,
      jira.email
    );

    const transition = await this.resolveInProgressTransition(jira, issue);

    const remote = await this.resolveRemote(git);

    const branch = await this.resolveBranch(git, remote, issue);

    const baseBranches = await this.resolveBaseBranches(git);

    const baseBranch = await this.resolveBaseBranch(git, baseBranches);

    this.log(
      chalk.yellow("!"),
      format(
        "This will create a pull request for %s into %s",
        chalk.cyan(branch),
        chalk.cyan(baseBranch)
      )
    );

    const startingPoint = await this.resolveStartingPoint(
      baseBranches,
      baseBranch
    );

    this.log(
      chalk.yellow("!"),
      format(
        "%s will be based on %s",
        chalk.cyan(branch),
        chalk.cyan(startingPoint)
      )
    );

    await this.handlePullRequestAlreadyExists(git, branch, baseBranch);

    const pullRequestTitle = await this.resolvePullRequestTitle(issue, branch);

    const pullRequestDescription = this.getPullRequestDescription(
      issue,
      branch
    );

    const emptyCommitMessage = this.getEmptyCommitMessage(issue, branch);

    const sequencer = this.getSequencer(jira, git);

    this.log();
    await sequencer.run({
      issue,
      transition,
      shouldAssignToMe,
      remote,
      branch,
      startingPoint,
      baseBranch,
      emptyCommitMessage,
      pullRequestTitle,
      pullRequestDescription,
    });
    this.log();

    await this.handleWhatsNext(jira, git, issue);
  }

  private async handleWhatsNext(
    jira: JiraService,
    git: GitService,
    issue: Issue | null
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

    this.log();
  }

  private getSequencer(jira: JiraService, git: GitService) {
    const sequencer = this.initActionSequencer<{
      issue: Issue | null;
      transition: IssueTransition | null;
      shouldAssignToMe: boolean | null;
      remote: string;
      branch: string;
      startingPoint: string;
      baseBranch: string;
      emptyCommitMessage: string;
      pullRequestTitle: string;
      pullRequestDescription: string;
    }>();

    sequencer.add({
      titles: ({ branch }) => ({
        [ActionSequenceState.Running]: format(
          "Switching branch to %s",
          chalk.cyan(branch)
        ),
        [ActionSequenceState.Completed]: format(
          "Switched branch to %s",
          chalk.cyan(branch)
        ),
        [ActionSequenceState.Failed]: format(
          "Could not switch branch to %s",
          chalk.cyan(branch)
        ),
      }),
      action: async ({ branch, startingPoint, remote }) => {
        // TODO distribute through Homebrew.
        // TODO add custom lifecycles, e.g. running linting before readying a PR.

        await git.fetch();

        const remoteStartingPoint = await git.getRemoteBranch(startingPoint);

        console.log({ startingPoint, remoteStartingPoint, branch, remote });

        await git.checkout([
          "-B",
          branch,
          remoteStartingPoint ?? startingPoint,
        ]);

        const currentBranch = await git.getCurrentBranch();

        if (currentBranch !== branch) {
          throw new Error(
            format(
              "Expected current branch to be %s but got %s",
              branch,
              currentBranch
            )
          );
        }

        await git.push(["-f", "-u", remote, branch]);

        const remoteBranch = await git.getRemoteBranch(branch);
        const expectedRemoteBranch = format("%s/%s", remote, branch);

        if (remoteBranch !== expectedRemoteBranch) {
          throw new Error(
            format(
              "Expected remote branch to be %s but got %s",
              expectedRemoteBranch,
              remoteBranch
            )
          );
        }
      },
    });

    sequencer.add({
      titles: ({ issue }) => ({
        [ActionSequenceState.Running]: format(
          "Assigning %s to %s",
          chalk.cyan(jira.email),
          chalk.cyan(issue!.key)
        ),
        [ActionSequenceState.Completed]: format(
          "Assigned %s to %s",
          chalk.cyan(jira.email),
          chalk.cyan(issue!.key)
        ),
        [ActionSequenceState.Failed]: format(
          "Could not assign %s to %s",
          chalk.cyan(jira.email),
          chalk.cyan(issue!.key)
        ),
      }),
      ignoreWhen({ issue }) {
        return !issue;
      },
      action: async ({ shouldAssignToMe, issue }, sequence) => {
        const user = await jira.client.myself.getCurrentUser();

        if (issue!.fields.assignee?.accountId === user.accountId) {
          sequence.skip(
            format(
              "Skipped assigning issue. %s is already assigned to %s",
              chalk.cyan(issue!.key),
              chalk.cyan(jira.email)
            )
          );
        }

        if (!shouldAssignToMe) {
          sequence.skip(
            "Skipped assigning issue. You chose not to assign yourself."
          );
        }

        await jira.client.issues.assignIssue({
          issueIdOrKey: issue!.key,
          accountId: user.accountId,
        });
      },
    });

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
      ignoreWhen({ transition }) {
        return !transition;
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
          transition: transition!,
        });
      },
    });

    sequencer.add({
      titles: ({ branch, baseBranch }) => ({
        [ActionSequenceState.Running]: format(
          "Creating pull request for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch)
        ),
        [ActionSequenceState.Completed]: "Created pull request", // TODO include link or pr number
        [ActionSequenceState.Failed]: format(
          "Could not create pull request for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch)
        ),
      }),
      action: async ({
        branch,
        baseBranch,
        emptyCommitMessage,
        pullRequestTitle,
        pullRequestDescription,
      }) => {
        const [remoteBranch, remoteBaseBranch] = await Promise.all([
          git.getRemoteBranch(branch),
          git.getRemoteBranch(baseBranch),
        ]);

        if (
          remoteBranch &&
          remoteBaseBranch &&
          remoteBranch === remoteBaseBranch
        ) {
          throw new Error(
            "Cannot create a pull request from a branch into itself."
          );
        }

        const hasCommitsBetween = Boolean(
          await git.diff([`${baseBranch}..${branch}`, "| head -n 1"])
        );

        if (!hasCommitsBetween) {
          await git.commit(emptyCommitMessage, [
            "--allow-empty",
            "--no-verify",
          ]);
          await git.push();
        }

        const createPullRequestFlagOptions: FlagOptions = [
          `--title "${pullRequestTitle}"`,
          `--body "${pullRequestDescription}"`,
          `--base ${baseBranch}`,
          `--head ${branch}`,
        ];

        try {
          await git.createPullRequest([
            ...createPullRequestFlagOptions,
            "--draft",
          ]);
        } catch (error) {
          if (error instanceof DraftPullRequestNotSupportedError) {
            await git.createPullRequest(createPullRequestFlagOptions);
          }
        }
      },
    });

    return sequencer;
  }

  private getEmptyCommitMessage(issue: Issue | null, branch: string) {
    const template = this.config.saga.get("emptyCommitMessageTemplate") ?? "";

    const templateFn = doT.template(template, {
      argName: ["jiraHostname", "issue", "branch"],
    });

    const emptyCommitMessage = templateFn({
      jiraHostname: this.config.saga.get("jiraHostname"),
      issue,
      branch,
    });

    return emptyCommitMessage;
  }

  private getPullRequestDescription(issue: Issue | null, branch: string) {
    const template = this.config.saga.get("prBodyTemplate") ?? "";

    const templateFn = doT.template(template, {
      argName: ["jiraHostname", "issue", "branch"],
    });

    const pullRequestDescription = templateFn({
      jiraHostname: this.config.saga.get("jiraHostname"),
      issue,
      branch,
    });

    return pullRequestDescription;
  }

  private async resolvePullRequestTitle(issue: Issue | null, branch: string) {
    const template = this.config.saga.get("prTitleTemplate") ?? "";

    const templateFn = doT.template(template, {
      argName: ["jiraHostname", "issue", "branch"],
    });

    const defaultPullRequestTitle = templateFn({
      jiraHostname: this.config.saga.get("jiraHostname"),
      issue,
      branch,
    });

    const pullRequestTitle = await choosePrTitle(defaultPullRequestTitle);
    // TODO validate against pattern

    return pullRequestTitle;
  }

  private async handlePullRequestAlreadyExists(
    git: GitService,
    branch: string,
    baseBranch: string
  ) {
    const openPullRequestExists = await git.openPullRequestExists({
      head: branch,
      base: baseBranch,
    });

    if (openPullRequestExists) {
      this.log(
        chalk.red("✗"),
        format(
          "A pull request for %s into %s already exists.",
          chalk.cyan(branch),
          chalk.cyan(baseBranch)
        )
      );

      throw new ExitError(1);
    }
  }

  private async resolveStartingPoint(
    branches: string[],
    defaultBranch: string
  ) {
    const askForStartingPoint = this.config.saga.get("askForStartingPoint");

    if (!askForStartingPoint) return defaultBranch;

    branches.sort((a, b) => {
      if (a === defaultBranch) return -1;
      if (b === defaultBranch) return 1;
      return 0;
    });

    let startingPoint: string;

    switch (true) {
      case branches.length > 1:
        startingPoint = await chooseStartingPoint(branches);
        break;
      case branches.length === 1:
        startingPoint = branches[0];
        break;
      default:
        startingPoint = defaultBranch;
        break;
    }

    if (branches.length <= 1) {
      this.log(
        chalk.yellow("!"),
        format(
          "Using %s as starting point since there are no other branches to choose from.",
          chalk.cyan(startingPoint)
        )
      );
    }

    return startingPoint;
  }

  private async resolveBaseBranch(git: GitService, branches: string[]) {
    let branch: string;

    switch (true) {
      case branches.length > 1:
        branch = await chooseBaseBranch(branches);
        break;
      case branches.length === 1:
        branch = branches[0];
        break;
      default:
        branch = await git.getCurrentBranch();
        break;
    }

    if (branches.length <= 1) {
      this.log(
        chalk.yellow("!"),
        format(
          "Using %s as base branch since there are no other branches to choose from.",
          chalk.cyan(branch)
        )
      );
    }

    return branch;
  }

  private async resolveBaseBranches(git: GitService) {
    const [popularBaseBranches, remoteBranches, localBranches] =
      await Promise.all([
        git.listPopularBaseBranches(),
        git.listRemoteBranches(),
        git.listLocalBranches(),
      ]);

    const filteredPopularBaseBranches = popularBaseBranches.filter(
      (popularBaseBranch) => {
        return remoteBranches.find((remoteBranch) =>
          remoteBranch.includes(popularBaseBranch)
        );
      }
    );

    const filteredLocalBranches = localBranches.filter((localBranch) => {
      return remoteBranches.find((remoteBranch) =>
        remoteBranch.includes(localBranch)
      );
    });

    const baseBranches = Array.from(
      new Set([
        ...filteredPopularBaseBranches,
        ...filteredLocalBranches,
        ...remoteBranches,
      ])
    );

    return baseBranches;
  }

  private async resolveRemote(git: GitService) {
    const remotes = await git.listRemotes();

    if (remotes.length > 1) {
      return await chooseChoice("Select a remote", remotes);
    } else if (remotes.length === 1) {
      return remotes[0];
    } else {
      this.log(
        chalk.red("✗"),
        "No remotes found. Please add a remote to continue."
      );

      throw new ExitError(1);
    }
  }

  private async resolveBranch(
    git: GitService,
    remote: string,
    issue: Issue | null
  ) {
    const template = this.config.saga.get("branchNameTemplate") ?? "";

    const templateFn = doT.template(template, {
      argName: ["jiraHostname", "issue"],
    });

    const defaultBranch = templateFn({
      jiraHostname: this.config.saga.get("jiraHostname"),
      issue,
    });

    const branchNamePattern = new RegExp(
      this.config.saga.get("branchNamePattern") ?? ""
    );

    const branch = await chooseBranch(defaultBranch, async (input) => {
      if (!branchNamePattern.test(input)) {
        return "Branch name does not match pattern.";
      }

      if (input.startsWith(`${remote}/`)) {
        return "Branch name should not start with name of a remote.";
      }

      const isBranchNameValid = await git.isBranchNameValid(input);

      if (!isBranchNameValid) {
        return "Branch name is invalid.";
      }

      const remoteBranch = await git.getRemoteBranch(input);
      if (input === remoteBranch) {
        return "Remote branch with same name already exists.";
      }

      return true;
    });

    return branch;
  }

  private async resolveInProgressTransition(
    jira: JiraService,
    issue: Issue | null
  ) {
    if (!issue) return null;

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

    const workingStatus = this.config.saga.get("workingStatus");

    if (workingStatus) {
      const transition = filteredTransitions.find(
        (transition) => transition.name === workingStatus
      );

      if (transition) return transition;

      this.log(
        chalk.yellow("!"),
        format(
          "The issue status %s is no longer available for this issue.",
          chalk.cyan(workingStatus)
        )
      );
    }

    const transition = await chooseTransition(filteredTransitions);

    if (transition.name) {
      this.config.saga.set("workingStatus", transition.name);
    }

    return transition;
  }

  private async resolveShouldAssignToMe(issue: Issue | null, email: string) {
    if (!issue) return null;

    if (issue.fields.assignee?.emailAddress !== email) {
      return chooseAssignToMe(!issue.fields.assignee);
    }

    return false;
  }

  private async handleIssueLinkedToBranch(
    jira: JiraService,
    issue: Issue | null
  ) {
    if (!issue) return;

    const { detail } = await jira.getIssueDevStatus(issue);

    const linkedBranch = detail.at(0)?.branches.at(0)?.name;

    if (linkedBranch) {
      this.log(
        chalk.yellow("!"),
        format("This issue is already linked to %s", chalk.cyan(linkedBranch))
      );
    }
  }

  private async resolveIssue(jira: JiraService, projectKey: string) {
    const jql = `
      project = "${projectKey}" AND statusCategory IN (
        ${StatusCategory.ToDo},
        ${StatusCategory.InProgress}
      ) ORDER BY lastViewed DESC
    `;

    this.spinner.start();

    const issues = await jira.fetchAllPages<Issue>(async (startAt) => {
      const searchResults =
        await jira.client.issueSearch.searchForIssuesUsingJql({
          maxResults: 100,
          startAt,
          jql,
          fieldsByKeys: true,
          fields: [
            "summary",
            "status",
            "issuetype",
            "parent",
            "priority",
            "assignee",
            "description",
          ],
        });

      if (
        searchResults.maxResults === undefined ||
        searchResults.startAt === undefined ||
        searchResults.issues === undefined
      ) {
        throw new Error("Failed to fetch issues.");
      }

      return {
        maxResults: searchResults.maxResults,
        startAt: searchResults.startAt,
        values: searchResults.issues,
      };
    });

    const colors: Record<string, string> = {};

    const promises = issues.map(async (issue) => {
      const { issuetype } = issue.fields;

      if (issuetype?.iconUrl) {
        const color = await jira.colorFromSvg(issuetype.iconUrl);
        colors[issue.key] = color ?? "";
      }
    });

    await Promise.all(promises);

    this.spinner.stop();

    const issue = await chooseIssue(issues, colors);

    return issue;
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
