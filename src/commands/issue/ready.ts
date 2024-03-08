import { Flags } from "@oclif/core"
import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import { Issue, IssueTransition } from "jira.js/out/version3/models/index.js"
import { format } from "node:util"
import { AuthCommand } from "../../AuthCommand.js"
import { ActionSequenceState } from "../../actions/index.js"
import { GitService } from "../../services/git/index.js"
import { JiraService, StatusCategory } from "../../services/jira/index.js"
import {
  chooseChecklist,
  chooseChoice,
  chooseTransition,
} from "../../ux/prompts/index.js"

export default class Ready extends AuthCommand {
  static override summary = "Mark an issue as ready for review"

  static override flags = {
    // reviewer: Flags.string({
    //   char: "r",
    //   description: "Reviewers to add to the pull request, separated by commas",
    // }),
    undo: Flags.boolean({
      char: "u",
      description:
        "Mark the pull request as a draft and transition the issue to its working status",
    }),
  }

  async run() {
    const { flags } = await this.parse(Ready)

    this.spinner.start()

    const [jira, git] = await Promise.all([
      this.initJiraService(),
      this.initGitService(),
    ])

    const issue = await this.resolveIssue(jira, git)

    const shouldUndo = flags.undo

    const transition = await this.resolveIssueTransition(
      jira,
      issue,
      shouldUndo,
    )

    const reviewers = await this.resolveReviewers(git, shouldUndo)

    const sequencer = this.getSequencer(jira, git, shouldUndo)

    this.log()
    await sequencer.run({ issue, transition, reviewers })
    this.log()

    await this.handleWhatsNext(jira, git, issue)
  }

  private async handleWhatsNext(
    jira: JiraService,
    git: GitService,
    issue: Issue,
  ) {
    enum Choice {
      Skip = "Skip",
      OpenPullRequest = "Open pull request in browser",
      OpenIssue = "Open issue in browser",
      OpenBoth = "Open issue and pull request in browser",
    }

    const choice = await chooseChoice("What's next?", [
      Choice.Skip,
      Choice.OpenPullRequest,
      Choice.OpenIssue,
      Choice.OpenBoth,
    ])

    switch (choice) {
      case Choice.OpenPullRequest:
        this.open(await git.fetchPullRequestUrl())
        break
      case Choice.OpenIssue:
        this.open(jira.constructIssueUrl(issue))
        break
      case Choice.OpenBoth:
        this.open(await git.fetchPullRequestUrl())
        this.open(jira.constructIssueUrl(issue))
        break
    }

    this.log()
  }

  private getSequencer(
    jira: JiraService,
    git: GitService,
    shouldUndo: boolean,
  ) {
    const sequencer = this.initActionSequencer<{
      issue: Issue
      transition: IssueTransition
      reviewers: string[]
    }>()

    sequencer.add({
      titles: ({ issue, transition }) => ({
        [ActionSequenceState.Running]: format(
          "Transitioning %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
        [ActionSequenceState.Completed]: format(
          "Transitioned %s from %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(issue.fields.status.name),
          chalk.cyan(transition.name),
        ),
        [ActionSequenceState.Failed]: format(
          "Could not transition %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      }),
      action: async ({ issue, transition }, sequence) => {
        if (issue.fields.status.name === transition.name) {
          sequence.skip(
            format(
              "Skipped transition. %s is already in %s",
              chalk.cyan(issue.key),
              chalk.cyan(transition.name),
            ),
          )
        }

        await jira.client.issues.doTransition({
          issueIdOrKey: issue.key,
          transition,
        })
      },
    })

    if (shouldUndo) {
      sequencer.add({
        titles: () => ({
          [ActionSequenceState.Running]: "Marking pull request as draft",
          [ActionSequenceState.Completed]: "Marked pull request as draft",
          [ActionSequenceState.Failed]: "Could not mark pull request as draft",
        }),
        action: async () => {
          await git.markPullRequestAsDraft()
        },
      })
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
          await git.markPullRequestAsReady()
        },
      })
    }

    if (shouldUndo) {
      return sequencer
    }

    sequencer.add({
      titles: ({ reviewers }) => ({
        [ActionSequenceState.Running]: "Requesting reviewers for review",
        [ActionSequenceState.Completed]: format(
          "Requested %s for review",
          chalk.cyan(reviewers.join(", ")),
        ),
        [ActionSequenceState.Failed]: "Could not request reviewers for review",
      }),
      action: async ({ reviewers }, sequence) => {
        if (reviewers.length === 0) {
          sequence.skip("No reviewers requested for review")
        }

        await git.addReviewers(reviewers)
      },
    })

    return sequencer
  }

  private async resolveReviewers(git: GitService, shouldUndo: boolean) {
    if (shouldUndo) {
      return []
    }

    const teamMembers = await git.listTeamMembers()

    let reviewers: string[] = []

    if (teamMembers.length > 0) {
      reviewers = await chooseChecklist(
        "Who should review this pull request?",
        teamMembers,
      )
    }

    return reviewers
  }

  private async resolveIssueTransition(
    jira: JiraService,
    issue: Issue,
    shouldUndo: boolean,
  ): Promise<IssueTransition> {
    const { transitions } = await jira.client.issues.getTransitions({
      issueIdOrKey: issue.key,
    })

    if (!transitions) {
      throw new Error("Could not fetch transitions")
    }

    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.to?.statusCategory?.key === StatusCategory.InProgress,
    )

    const transitionStatus = shouldUndo
      ? this.config.saga.get("workingStatus")
      : this.config.saga.get("readyForReviewStatus")

    let transition: IssueTransition | null = null

    if (transitionStatus) {
      transition =
        filteredTransitions.find(
          (transition) => transition.name === transitionStatus,
        ) ?? null
    }

    if (!transition) {
      this.log(
        chalk.yellow("!"),
        format(
          "The issue status %s is no longer available for this issue.",
          chalk.cyan(transitionStatus),
        ),
      )

      transition = await chooseTransition(filteredTransitions)
    }

    return transition
  }

  private async resolveIssue(jira: JiraService, git: GitService) {
    const projectKey = this.config.saga.get("project")
    const currentBranch = await git.getCurrentBranch()

    let issueKey = jira.extractIssueKey(projectKey, currentBranch)

    if (!issueKey) {
      const details = await git.fetchPullRequestDetails(currentBranch)
      issueKey = details && jira.extractIssueKey(projectKey, details.body)
    }

    let issue: Issue | null = null

    if (issueKey) {
      issue = await jira.client.issues.getIssue({
        issueIdOrKey: issueKey,
      })
    }

    if (!issue) {
      this.log(
        chalk.red("✗"),
        format(
          "Could not find an issue for branch %s",
          chalk.cyan(currentBranch),
        ),
      )

      throw new ExitError(1)
    }

    return issue
  }
}
