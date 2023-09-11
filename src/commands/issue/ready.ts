// import { Flags } from "@oclif/core"
import { format } from "util"
import chalk from "chalk"
import { AuthenticatedCommand } from "../../authenticatedCommand.js"
import {
  GitService,
  NoPullRequestForBranchError,
} from "../../services/gitService.js"
import JiraService from "../../services/jiraService.js"
import { StatusCategory, Transition } from "../../@types/atlassian.js"
import { askTransition, askChoice, askChecklist } from "../../prompts/index.js"
import { TaskStatus, Tasker } from "../../tasker.js"

interface TaskerContext {
  transition: Transition
}

export default class Ready extends AuthenticatedCommand {
  static summary = "Mark an issue as ready for review"

  static flags = {
    // reviewer: Flags.string({
    //   char: "r",
    //   description: "Reviewers to add to the pull request, separated by commas",
    // }),
    // undo: Flags.boolean({
    //   char: "u",
    //   description:
    //     "Mark the pull request as a draft and transition the issue to the working status",
    // }),
  }

  async run(): Promise<void> {
    // const { flags } = await this.parse(Ready)

    this.action.start()

    const git = await new GitService({
      executor: this.exec,
    }).checkRequirements()

    const pullRequestExist = await git.doesPullRequestExist()
    if (!pullRequestExist) {
      throw new NoPullRequestForBranchError()
    }

    await git.pull()
    await git.push()

    const host = this.store.get("jiraHostname")
    const email = this.store.get("email")
    const token = await this.store.secrets.get("atlassianApiToken")

    const jira = new JiraService({
      host,
      email,
      token,
    })

    const branch = await git.getCurrentBranch()
    const issueKey = branch.match(/\p{Lu}+-\d+/u)?.[0] ?? ""
    const issue = await jira.findIssue(issueKey)

    if (!issue) {
      this.action.stop()
      console.log(
        format("Could not find an issue for branch %s", chalk.cyan(branch)),
      )
      return this.exit(1)
    }

    const transitions = await jira.listTransitions(issue.key)

    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.to.statusCategory.key === StatusCategory.InProgress ||
        transition.to.statusCategory.key === StatusCategory.Completed,
    )

    let transition: Transition | undefined
    const readyForReviewStatus = this.store.get("readyForReviewStatus")
    if (readyForReviewStatus) {
      transition = filteredTransitions.find(
        (transition) => transition.name === readyForReviewStatus,
      )
    }

    if (!transition) {
      this.action.stop()
      transition = await askTransition(filteredTransitions)
      this.store.set("readyForReviewStatus", transition.name)
      this.action.start()
    }

    let reviewers: string[] = []

    const teamMembers = await git.getTeamMembers()

    this.action.stop()

    if (teamMembers && teamMembers.length > 0) {
      reviewers = await askChecklist(
        "Who should review this pull request?",
        teamMembers,
      )
    }

    const tasks = new Tasker<TaskerContext>(
      [
        {
          titles: {
            [TaskStatus.Running]: format(
              "Transitioning %s to %s",
              chalk.cyan(issue.key),
              chalk.cyan(transition.name),
            ),
            [TaskStatus.Skipped]: format(
              "Skipped transition. %s is already in %s",
              chalk.cyan(issue.key),
              chalk.cyan(transition.name),
            ),
            [TaskStatus.Done]: format(
              "Transitioned %s from %s to %s",
              chalk.cyan(issue.key),
              chalk.cyan(issue.fields.status.name),
              chalk.cyan(transition.name),
            ),
            [TaskStatus.Failed]: format(
              "Could not transition %s to %s",
              chalk.cyan(issue.key),
              chalk.cyan(transition.name),
            ),
          },
          skip: ({ transition }) =>
            issue.fields.status.name === transition.name,
          action: ({ transition }) =>
            jira.transitionIssue(issue.key, transition.id),
        },
        {
          titles: {
            [TaskStatus.Running]: "Marking pull request as ready for review",
            [TaskStatus.Done]: "Marked pull request as ready for review",
            [TaskStatus.Failed]:
              "Could not mark pull request as ready for review",
          },
          action: () => git.markAsReady(),
        },
        {
          titles: {
            [TaskStatus.Running]: "Requesting reviewers for review",
            [TaskStatus.Skipped]: "No reviewers requested for review",
            [TaskStatus.Done]: format(
              "Requested %s for review",
              chalk.cyan(reviewers.join(", ")),
            ),
            [TaskStatus.Failed]: "Could not request reviewers for review",
          },
          skip: () => reviewers.length === 0,
          action: () => git.addReviewers(reviewers),
        },
      ],
      {
        onStatusChange: {
          [TaskStatus.Running]: (task) =>
            this.action.start(task.titles[TaskStatus.Running]),
          [TaskStatus.Skipped]: (task) =>
            this.action.warn(task.titles[TaskStatus.Skipped]),
          [TaskStatus.Done]: (task) =>
            this.action.succeed(task.titles[TaskStatus.Done]),
          [TaskStatus.Failed]: (task) =>
            this.action.fail(task.titles[TaskStatus.Failed]),
        },
      },
    )

    console.log()

    await tasks.run({ transition })

    console.log()

    enum OptionMessages {
      Skip = "Skip",
      OpenPullRequest = "Open pull request in browser",
      OpenIssue = "Open issue in browser",
      OpenBoth = "Open issue and pull request in browser",
    }

    const choice = await askChoice("What's next?", [
      OptionMessages.Skip,
      OptionMessages.OpenPullRequest,
      OptionMessages.OpenIssue,
      OptionMessages.OpenBoth,
    ])

    const issueUrl = format("https://%s/browse/%s", host, issue.key)

    switch (choice) {
      case OptionMessages.OpenPullRequest:
        this.open(await git.getPullRequestUrl())
        break
      case OptionMessages.OpenIssue:
        this.open(issueUrl)
        break
      case OptionMessages.OpenBoth:
        this.open(issueUrl)
        this.open(await git.getPullRequestUrl())
        break
    }

    console.log()
  }
}
