import { format } from "util"
import { Args, Flags } from "@oclif/core"
import chalk from "chalk"
import doT from "dot"
import { AuthenticatedCommand } from "../../authenticatedCommand.js"
import { GitService } from "../../services/gitService.js"
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
  askAssignYou,
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
  }

  async run(): Promise<void> {
    this.action.start()

    const { args, flags } = await this.parse(Start)

    const git = await new GitService({
      executor: this.exec,
    }).checkRequirements()

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

      this.action.stop()

      if (projects.length === 1) {
        projectKey = projects[0].key
        console.log(
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
        console.log(
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
        if (error instanceof Error) {
          this.logger.log(error.stack ?? error.message)
        }
      }

      if (!issue) {
        console.log(
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
        if (error instanceof Error) {
          this.logger.log(error.stack ?? error.message)
        }
      }

      this.action.stop()

      issue = await askIssue(issues)
    }

    let shouldAssignToUser = false
    if (issue.fields.assignee?.emailAddress !== email) {
      this.action.stop()
      shouldAssignToUser = await askAssignYou()
    }

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
      this.action.stop()
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

    this.action.stop()

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
          baseBranch = baseBranches[0]
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

    // // Confirm actions

    // const skipConfirmations = this.store.get("skipConfirmations") === "true"
    // if (!skipConfirmations) {
    //   console.log(
    //     `${chalk.yellow("!")} ${format(
    //       "You want to transition %s to %s",
    //       chalk.cyan(issue.key),
    //       chalk.cyan(transition.name),
    //     )}`,
    //   )

    //   if (shouldAssignToUser) {
    //     console.log(
    //       `${chalk.yellow("!")} ${format(
    //         "You want to be assigned %s",
    //         chalk.cyan(issue.key),
    //       )}`,
    //     )
    //   }

    //   console.log(
    //     `${chalk.yellow("!")} ${format(
    //       "You want a pull request for %s into %s",
    //       chalk.cyan(branch),
    //       chalk.cyan(baseBranch),
    //     )}`,
    //   )

    //   const shouldContinue = await askConfirmation()
    //   if (!shouldContinue) this.exit(0)
    // }

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

    if (shouldAssignToUser) {
      try {
        this.action.start(
          format(
            "Assigning issue %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(email),
          ),
        )
        const currentUser = await jira.getCurrentUser()
        await jira.assignIssue(issue.key, currentUser.accountId)
        this.action.succeed(
          format(
            "Assigned issue %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(email),
          ),
        )
      } catch (error) {
        isReadyForWork = false
        if (error instanceof Error) {
          this.logger.log(error.stack ?? error.message)
        }
        this.action.fail(
          format(
            "Could not assign issue %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(email),
          ),
        )
      }
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
      if (error instanceof Error) {
        this.logger.log(error.stack ?? error.message)
      }
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

      const commits = await git.getCommitsBetween(baseBranch, branch)

      if (commits.length === 0) {
        await git.commit(commitMessage, { allowEmpty: true, noVerify: true })
        await git.push()
      }

      await git.createPullRequest({
        head: branch,
        base: baseBranch,
        body: prBody,
        title: pullRequestTitle,
        isDraft: true,
      })

      this.action.succeed("Created pull request")
    } catch (error) {
      isReadyForWork = false
      if (error instanceof Error) {
        this.logger.log(error.stack ?? error.message)
      }
      this.action.fail(
        format(
          "Could not create pull request for %s into %s",
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )
    }

    console.log()

    if (!isReadyForWork) {
      this.catch(new Error("Something went wrong."))
    }

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

    console.log()
  }
}
