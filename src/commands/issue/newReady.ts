import { ExitError } from "@oclif/core/lib/errors/index.js"
import { AuthCommand } from "../../AuthCommand.js"
import { GitService } from "../../services/git/index.js"
import { Issue, JiraService, Transition } from "../../services/jira/index.js"
import { format } from "node:util"
import chalk from "chalk"
import askTransition from "../../ux/prompts/askTransition.js"
import { askChecklist } from "../../ux/prompts/index.js"

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

    await this.applyChoices(issue, transition, reviewers)
  }

  private async applyChoices(
    issue: Issue,
    transition: Transition,
    reviewers: string[],
  ) {}

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
      const details = await git.getPullRequestDetails(currentBranch)
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
