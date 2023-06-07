import { format } from "util"
import { Args, Flags } from "@oclif/core"
import chalk from "chalk"
import doT from "dot"
import { AuthenticatedCommand } from "../../authenticatedCommand.js"
import GitService from "../../services/gitService.js"
import JiraService from "../../services/jiraService.js"
import {
  Issue,
  Project,
  StatusCategory,
  Transition,
} from "../../@types/atlassian.js"
import {
  askProject,
  askIssue,
  askTransition,
  askBranchName,
  askBaseBranch,
  askPrTitle,
  askChoice,
} from "../../prompts/index.js"

export default class Start extends AuthenticatedCommand {
  static summary = "Start working on an issue"

  static args = {
    id: Args.string({ description: "Id or key of the issue to work on" }),
  }

  static flags = {
    "list-projects": Flags.boolean({
      description: "List all projects you have access to",
    }),
    debug: Flags.boolean({
      description:
        "Show more information about the process, useful for debugging",
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Start)

    const git = await new GitService({
      debug: flags.debug,
    }).checkRequirements()

    if (await git.hasUncommittedChanges()) {
      throw new Error("Stash or commit your changes before starting an issue.")
    }

    const host = this.store.get("jiraHostname")
    const email = this.store.get("email")
    const token = await this.store.secrets.get("atlassianApiToken")

    const jira = new JiraService({
      host,
      email,
      token,
    })

    let projectKey = this.store.get("project")
    if (!projectKey || flags["list-projects"]) {
      const projects = await jira.listProjects()

      if (projects.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        projectKey = projects.at(0)!.key
        this.log(
          `${chalk.yellow("!")} ${format(
            "Using %s as project since there are no other projects to choose from.",
            chalk.cyan(projectKey),
          )}`,
        )
      } else {
        const project = await askProject(projects as Project[])
        projectKey = project.key
      }

      this.store.set("project", projectKey)

      if (!flags["list-projects"] && projects.length > 1) {
        this.log(
          `${format(
            "You can view and select a different project at any time by adding the %s flag",
            chalk.bold("--list-projects"),
          )}`,
        )
      }
    }

    let issue: Issue | null | undefined
    if (args.id) {
      if (!args.id.startsWith(projectKey)) {
        args.id = `${projectKey}-${args.id}`
      }

      try {
        issue = await jira.findIssue(args.id)
      } catch (error) {
        if (flags.debug) console.error(error)
      }

      if (!issue) {
        this.log(
          `${chalk.yellow("!")} ${format(
            "Unable to find an issue with id %s",
            chalk.cyan(args.id),
          )}`,
        )
      }
    }

    if (!issue) {
      const jql = `
        project = "${projectKey}" AND (
          assignee IN (currentUser()) OR
          assignee IS EMPTY
        ) AND statusCategory IN (
          ${StatusCategory.ToDo},
          ${StatusCategory.InProgress}
        ) ORDER BY lastViewed DESC
      `

      let issues: Issue[] = []
      try {
        issues = await jira.findIssuesByJql(jql)
      } catch (error) {
        if (flags.debug) console.error(error)
      }

      issue = await askIssue(issues)
    }

    issue.url = `https://${host}/browse/${issue.key}`

    const transitions = await jira.listTransitions(issue.key)

    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.to.statusCategory.key === StatusCategory.InProgress,
    )

    let transition: Transition | undefined
    const workingStatus = this.store.get("workingStatus")
    if (workingStatus) {
      transition = filteredTransitions.find(
        (transition) => transition.name === workingStatus,
      )
    }

    if (!transition) {
      transition = await askTransition(filteredTransitions)
      this.store.set("workingStatus", transition.name)
    }

    const branchNamePattern = new RegExp(
      this.store.get("branchNamePattern") || "(?:)",
    )
    const branchNameTemplate = this.store.get("branchNameTemplate") || ""
    const defaultBranchName = doT.template(branchNameTemplate, {
      argName: ["issue"],
    })({ issue })

    const branch = await askBranchName(defaultBranchName, (value: string) => {
      if (!branchNamePattern?.test(value)) {
        return `Your branch name must match the pattern ${chalk.red(
          branchNamePattern,
        )}`
      }

      return true
    })

    await git.fetch({ prune: true })

    const [popularBaseBranches, remoteBranches] = await Promise.all([
      git.getPopularBaseBranches(),
      git.getRemoteBranches(),
    ])

    const baseBranches = [
      ...new Set([...popularBaseBranches, ...remoteBranches]),
    ].filter((branch) => remoteBranches.includes(branch))

    let baseBranch = this.store.get("baseBranch")
    if (!baseBranch || !baseBranches.includes(baseBranch)) {
      if (baseBranches.length > 1) {
        baseBranch = await askBaseBranch(baseBranches)
      } else {
        if (baseBranches.length === 1) {
          baseBranch = baseBranches.pop() as string
        } else {
          baseBranch = await git.getCurrentBranch()
        }

        console.log(
          `${chalk.yellow("!")} ${format(
            "Using %s as base branch since there are no other branches to choose from.",
            chalk.cyan(baseBranch),
          )}`,
        )
      }
    }

    if (await git.doesOpenPrExist(branch, baseBranch)) {
      console.error(
        `${chalk.red("✗")} ${format(
          "An open pull request already exists for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        )}`,
      )
      this.exit(1)
    }

    const prTitlePattern = new RegExp(
      this.store.get("prTitlePattern") || "(?:)",
    )
    const prTitleTemplate = this.store.get("prTitleTemplate") || ""
    const defaultPrTitle = doT.template(prTitleTemplate, {
      argName: ["issue"],
    })({ issue })

    const pullRequestTitle = await askPrTitle(
      defaultPrTitle,
      (value: string) =>
        (prTitlePattern?.test(value) ?? true) ||
        `Your pull request title must match the pattern ${chalk.red(
          prTitlePattern,
        )}`,
    )

    const prBodyTemplate = this.store.get("prBodyTemplate") || ""
    const defaultPrBody = doT.template(prBodyTemplate, {
      argName: ["issue"],
    })({ issue })

    const prBody = defaultPrBody

    const commitMessage =
      this.store.get("emptyCommitMessageTemplate") || pullRequestTitle

    // Submit

    let isReadyForWork = true

    console.log()

    this.action.start(format("Switching branch to %s", chalk.cyan(branch)))

    await git.fetch({ prune: true })
    await git.checkoutBranch(baseBranch)
    await git.pull()
    await git.createBranch(branch)
    await git.checkoutBranch(branch)
    await git.setUpstream(branch, "origin")

    const currentBranch = await git.getCurrentBranch()

    if (branch === currentBranch) {
      this.action.succeed(format("Switched branch to %s", chalk.cyan(branch)))
    } else {
      isReadyForWork = false
      this.action.fail(
        format("Could not switch branch to %s", chalk.cyan(branch)),
      )
    }

    try {
      this.action.start(
        format(
          "Transitioning issue %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )

      if (issue.fields.status.name !== transition.name) {
        await jira.transitionIssue(issue.key, transition.id)
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
      isReadyForWork = false
      if (flags.debug) console.error(error)
      this.action.fail(
        format(
          "Could not transition issue %s to %s",
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )
    }

    try {
      this.action.start(
        format(
          "Creating pull request for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )

      await git.createPullRequest(pullRequestTitle, prBody, {
        sourceBranch: branch,
        targetBranch: baseBranch,
        commitMessage,
        pushEmptyCommit: true,
        isDraft: true,
      })

      this.action.succeed("Created pull request")
    } catch (error) {
      isReadyForWork = false
      if (flags.debug) console.error(error)
      this.action.fail(
        format(
          "Could not create pull request for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )
    }

    console.log()

    if (isReadyForWork) {
      enum Choices {
        Skip = "Skip",
        OpenPullRequest = "Open pull request in browser",
        OpenIssue = "Open issue in browser",
        OpenBoth = "Open issue and pull request in browser",
      }

      const choice = await askChoice("What's next?", [
        Choices.Skip,
        Choices.OpenPullRequest,
        Choices.OpenIssue,
        Choices.OpenBoth,
      ])

      switch (choice) {
        case Choices.OpenPullRequest:
          this.open(await git.getPullRequestUrl())
          break
        case Choices.OpenIssue:
          this.open(issue.url)
          break
        case Choices.OpenBoth:
          this.open(await git.getPullRequestUrl())
          this.open(issue.url)
          break
      }
    } else {
      let message = `${chalk.yellow("!")} Something went wrong.`
      if (!flags.debug) {
        message += format(
          " You can run the command with the %s flag to get more information.",
          chalk.bold("--debug"),
        )
      }

      console.log(message)
    }

    console.log()
  }
}
