import { Flags } from "@oclif/core"
import { format } from "util"
import chalk from "chalk"
import JiraApi from "jira-client"
import { AuthenticatedCommand } from "../../authenticatedCommand.js"
import { Issue, StatusCategory, Transition } from "../../@types/atlassian.js"
import GitService from "../../services/gitService.js"
import { askTransition, askChoice } from "../../prompts/index.js"

export default class Ready extends AuthenticatedCommand {
  static summary = "Mark an issue as ready for review"

  // TODO add --reviewer -r flag.
  // TODO add --undo flag.
  static flags = {
    debug: Flags.boolean({
      description:
        "Show more information about the process, useful for debugging",
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Ready)

    this.action.start()

    const git = await new GitService({
      debug: flags.debug,
    }).checkRequirements()

    const pullRequestExist = await git.doesPullRequestExist()
    if (!pullRequestExist) {
      this.action.stop()
      console.log(`${chalk.red("✗")} There is no pull request for this branch`)
      return this.exit(1)
    }

    const hasUncommittedChanges = await git.hasUncommittedChanges()
    if (hasUncommittedChanges) {
      this.action.stop()
      console.log(`${chalk.red("✗")} You have uncommitted changes`)
      return this.exit(1)
    }

    await git.pull()
    await git.push()

    const host = this.store.get("jiraHostname")
    const email = this.store.get("email")
    const token = await this.store.secrets.get("atlassianApiToken")

    const jira = new JiraApi({
      protocol: "https",
      host,
      username: email,
      password: token,
      apiVersion: "3",
      strictSSL: true,
    })

    const branch = await git.getCurrentBranch()
    const issueKey = branch.match(/\p{Lu}+-\d+/u)?.[0] ?? ""
    const issue = (await jira.getIssue(issueKey)) as Issue

    if (!issue) {
      this.action.stop()
      console.log(
        format("Could not find an issue for branch %s", chalk.cyan(branch)),
      )
      return this.exit(1)
    }

    const response = await jira.listTransitions(issue.key)
    const transitions = response.transitions as Transition[]

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

    this.action.stop()

    if (!transition) {
      transition = await askTransition(filteredTransitions)
      this.store.set("readyForReviewStatus", transition.name)
    }

    let isReadyForReview = true

    this.action.start(
      format(
        "Transitioning %s to %s",
        chalk.cyan(issue.key),
        chalk.cyan(transition.name),
      ),
    )
    try {
      if (issue.fields.status.name !== transition.name) {
        await jira.transitionIssue(issue.key, { transition })
        this.action.succeed(
          format(
            "Transitioned issue %s from %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(issue.fields.status.name),
            chalk.cyan(transition.name),
          ),
        )
      } else {
        this.action.succeed(
          format(
            "Skipped transition. Issue %s is already in %s",
            chalk.cyan(issue.key),
            chalk.cyan(transition.name),
          ),
        )
      }
    } catch (error) {
      isReadyForReview = false
      if (flags.debug) console.error(error)
      this.action.fail(
        format(
          "Could not transition %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )
    }

    this.action.start("Marking pull request as ready for review")
    try {
      await git.markAsReady()
      this.action.succeed("Marked pull request as ready for review")
    } catch (error) {
      isReadyForReview = false
      if (flags.debug) console.error(error)
      this.action.fail("Could not mark pull request as ready for review")
    }

    if (isReadyForReview) {
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
    }

    console.log()
  }
}
