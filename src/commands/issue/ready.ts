import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import { format } from "node:util"
import { AuthCommand } from "../../AuthCommand.js"
import { ActionSequenceState } from "../../actions/index.js"
import { GitService } from "../../services/git/index.js"
import { Issue, JiraService, Transition } from "../../services/jira/index.js"
import {
  askChecklist,
  askChoice,
  askTransition,
} from "../../ux/prompts/index.js"

export default class Ready extends AuthCommand {
  static summary = "Start working on an issue"

  static args = {}

  static flags = {}

  async run() {
    this.spinner.start()

    const jira = await this.initJiraService()
    const git = await this.initGitService()

    const issue = await this.resolveIssue(jira, git)

    const transition = await this.resolveTransition(jira, issue)

    const reviewers = await this.resolveReviewers(git)

    const sequencer = this.getSequencer(jira, git)

    this.log()
    await sequencer.run({ issue, transition, reviewers })
    this.log()

    await this.handleWhatsNext(git, issue)
  }

  private async handleWhatsNext(git: GitService, issue: Issue) {
    enum Choice {
      Skip = "Skip",
      OpenPullRequest = "Open pull request in browser",
      OpenIssue = "Open issue in browser",
      OpenBoth = "Open issue and pull request in browser",
    }

    const choice = await askChoice("What's next?", [
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
        this.open(issue.url)
        break
      case Choice.OpenBoth:
        this.open(await git.fetchPullRequestUrl())
        this.open(issue.url)
        break
    }

    this.log()
  }

  private getSequencer(jira: JiraService, git: GitService) {
    const sequencer = this.initActionSequencer<{
      issue: Issue
      transition: Transition
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

        await jira.transitionIssue(issue.key, transition.id)
      },
    })

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

  private async resolveReviewers(git: GitService) {
    const teamMembers = await git.listTeamMembers()

    let reviewers: string[] = []

    if (teamMembers.length > 0) {
      reviewers = await askChecklist(
        "Who should review this pull request?",
        teamMembers,
      )
    }

    return reviewers
  }

  private async resolveTransition(
    jira: JiraService,
    issue: Issue,
  ): Promise<Transition> {
    const transitions = await jira.listTransitions(issue.key)

    const readyForReviewStatus = this.config.saga.get("readyForReviewStatus")

    let transition: Transition | null = null

    if (readyForReviewStatus) {
      transition =
        transitions.find(
          (transition) => transition.name === readyForReviewStatus,
        ) ?? null
    }

    if (!transition) {
      transition = await askTransition(transitions)
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
      issue = await jira.findIssue(issueKey)
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
