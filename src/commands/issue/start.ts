import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import doT from "dot"
import { format } from "node:util"
import { AuthCommand } from "../../AuthCommand.js"
import { GitService } from "../../services/git/index.js"
import {
  Issue,
  JiraService,
  StatusCategory,
  Transition,
} from "../../services/jira/index.js"
import askIssue from "../../ux/prompts/askIssue.js"
import chooseProject from "../../ux/prompts/chooseProject.js"
import {
  askAssignToMe,
  askBaseBranch,
  askBranch,
  askCheckOutLinkedBranch,
  askChoice,
  askPrTitle,
  askStartingPoint,
  askTransition,
} from "../../ux/prompts/index.js"

interface ActionSequencerContext {
  git: GitService
  jira: JiraService
  issue: Issue
  branch: string
  baseBranch: string
  startingPoint: string
  transition: Transition
  shouldAssignToMe: boolean
  pullRequestTitle: string
  pullRequestDescription: string
  emptyCommitMessage: string
}

export default class Start extends AuthCommand {
  static summary = "Start working on an issue"

  static args = {}

  static flags = {}

  async run() {
    const jira = await this.initJiraService()
    const git = await this.initGitService()

    const projectKey = await this.resolveProjectKey(jira)

    const issue = await this.resolveIssue(jira, projectKey)

    const linkedBranch = await jira.getLinkedBranch(issue.id)

    if (linkedBranch) {
      await this.handleIssueLinkedToBranch(git, linkedBranch)
    }

    const shouldAssignToMe = await this.resolveShouldAssignToMe(
      issue,
      jira.email,
    )

    const transition = await this.resolveInProgressTransition(jira, issue)

    const branch = await this.resolveBranch(git, issue)

    const branches = await git.listPopularBaseBranches()

    const baseBranch = await this.resolveBaseBranch(git, branches)

    this.log(
      chalk.yellow("!"),
      format(
        "This will create a pull request for %s into %s",
        chalk.cyan(branch),
        chalk.cyan(baseBranch),
      ),
    )

    const startingPoint = await this.resolveStartingPoint(branches, baseBranch)

    this.log(
      chalk.yellow("!"),
      format(
        "%s will be based on %s",
        chalk.cyan(branch),
        chalk.cyan(startingPoint),
      ),
    )

    await this.handlePullRequestAlreadyExists(git, branch, baseBranch)

    const pullRequestTitle = await this.resolvePullRequestTitle(issue, branch)

    const pullRequestDescription = this.getPullRequestDescription(issue, branch)

    const emptyCommitMessage = this.getEmptyCommitMessage(issue, branch)

    await this.submit({
      git,
      jira,
      issue,
      branch,
      baseBranch,
      startingPoint,
      transition,
      shouldAssignToMe,
      pullRequestTitle,
      pullRequestDescription,
      emptyCommitMessage,
    })

    await this.handleWhatsNext(git, issue)
  }

  private async handleWhatsNext(git: GitService, issue: Issue) {
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
        this.open(await git.fetchPullRequestUrl())
        break
      case Choices.OpenIssue:
        this.open(issue.url)
        break
      case Choices.OpenBoth:
        this.open(await git.fetchPullRequestUrl())
        this.open(issue.url)
        break
    }

    this.log()
  }

  private async submit(context: ActionSequencerContext) {
    const sequencer = this.initActionSequencer<typeof context>()

    sequencer.add(
      {
        titles: ({ branch }) => ({
          running: format("Switching branch to %s", chalk.cyan(branch)),
          completed: format("Switched branch to %s", chalk.cyan(branch)),
          failed: format("Could not switch branch to %s", chalk.cyan(branch)),
        }),
        action: () => this.wait(600),
      },
      {
        titles: ({ jira: { email }, issue }) => ({
          running: format(
            "Assigning %s to %s",
            chalk.cyan(email),
            chalk.cyan(issue.key),
          ),
          completed: format(
            "Assigned %s to %s",
            chalk.cyan(email),
            chalk.cyan(issue.key),
          ),
          failed: format(
            "Could not assign %s to %s",
            chalk.cyan(email),
            chalk.cyan(issue.key),
          ),
        }),
        action: async (context, sequence) => {
          await this.wait(1200)
        },
      },
      {
        titles: ({ issue, transition }) => ({
          running: format(
            "Transitioning %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(transition.name),
          ),
          skipped: format(
            "Skipped transition. %s is already in %s",
            chalk.cyan(issue.key),
            chalk.cyan(transition.name),
          ),
          completed: format(
            "Transitioned %s from %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(issue.fields.status.name),
            chalk.cyan(transition.name),
          ),
          failed: format(
            "Could not transition %s to %s",
            chalk.cyan(issue.key),
            chalk.cyan(transition.name),
          ),
        }),
        action: async (_, sequence) => {
          await this.wait(900)
          sequence.skip()
        },
      },
      {
        titles: ({ branch, baseBranch }) => ({
          running: format(
            "Creating pull request for %s into %s",
            chalk.cyan(branch),
            chalk.cyan(baseBranch),
          ),
          completed: "Created pull request",
          failed: format(
            "Could not create pull request for %s into %s",
            chalk.cyan(branch),
            chalk.cyan(baseBranch),
          ),
        }),
        action: async () => {
          await this.wait(2500)
          // throw new Error("Something went wrong")
        },
      },
    )

    this.log()

    await sequencer.run(context)

    this.log()
  }

  private getEmptyCommitMessage(issue: Issue, branch: string) {
    const template = this.config.saga.get("emptyCommitMessageTemplate")

    const templateFn = doT.template(template, { argName: ["issue", "branch"] })

    const emptyCommitMessage = templateFn({ issue, branch })

    return emptyCommitMessage
  }

  private getPullRequestDescription(issue: Issue, branch: string) {
    const template = this.config.saga.get("prBodyTemplate")

    const templateFn = doT.template(template, { argName: ["issue", "branch"] })

    const pullRequestDescription = templateFn({ issue, branch })

    return pullRequestDescription
  }

  private async resolvePullRequestTitle(issue: Issue, branch: string) {
    const template = this.config.saga.get("prTitleTemplate")

    const templateFn = doT.template(template, { argName: ["issue", "branch"] })

    const defaultPullRequestTitle = templateFn({ issue, branch })

    const pullRequestTitle = await askPrTitle(defaultPullRequestTitle)

    return pullRequestTitle
  }

  private async handlePullRequestAlreadyExists(
    git: GitService,
    branch: string,
    baseBranch: string,
  ) {
    const openPullRequestExists = await git.openPullRequestExists(
      branch,
      baseBranch,
    )

    if (openPullRequestExists) {
      this.log(
        chalk.red("✗"),
        format(
          "A pull request for %s into %s already exists.",
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )

      throw new ExitError(1)
    }
  }

  private async resolveStartingPoint(
    branches: string[],
    defaultBranch: string,
  ) {
    const askForStartingPoint = this.config.saga.get("askForStartingPoint")

    if (!askForStartingPoint) return defaultBranch

    let startingPoint: string

    switch (true) {
      case branches.length > 1:
        startingPoint = await askStartingPoint(branches)
        break
      case branches.length === 1:
        startingPoint = branches[0]
        break
      default:
        startingPoint = defaultBranch
        break
    }

    if (branches.length <= 1) {
      this.log(
        chalk.yellow("!"),
        format(
          "Using %s as starting point since there are no other branches to choose from.",
          chalk.cyan(startingPoint),
        ),
      )
    }

    return startingPoint
  }

  private async resolveBaseBranch(git: GitService, branches: string[]) {
    let branch: string

    switch (true) {
      case branches.length > 1:
        branch = await askBaseBranch(branches)
        break
      case branches.length === 1:
        branch = branches[0]
        break
      default:
        branch = await git.getCurrentBranch()
        break
    }

    if (branches.length <= 1) {
      this.log(
        chalk.yellow("!"),
        format(
          "Using %s as base branch since there are no other branches to choose from.",
          chalk.cyan(branch),
        ),
      )
    }

    return branch
  }

  private async resolveBranch(git: GitService, issue: Issue) {
    const template = this.config.saga.get("branchNameTemplate")

    const templateFn = doT.template(template, { argName: ["issue"] })

    const defaultBranchName = templateFn({ issue })

    const branchName = await askBranch(defaultBranchName) // TODO validate branch name

    return branchName
  }

  private async resolveInProgressTransition(jira: JiraService, issue: Issue) {
    const transitions = await jira.listTransitions(issue.key)

    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.to.statusCategory.key === StatusCategory.InProgress,
    )

    const workingStatus = this.config.saga.get("workingStatus")

    if (workingStatus) {
      const transition = filteredTransitions.find(
        (transition) => transition.name === workingStatus,
      )

      if (transition) return transition

      this.log(
        chalk.yellow("!"),
        format(
          "The working status %s is no longer available for this issue.",
          chalk.cyan(workingStatus),
        ),
      )
    }

    const transition = await askTransition(filteredTransitions)

    this.config.saga.set("workingStatus", transition.name)

    return transition
  }

  private async resolveShouldAssignToMe(issue: Issue, email: string) {
    if (issue.fields.assignee?.emailAddress !== email) {
      return askAssignToMe(!issue.fields.assignee)
    }

    return false
  }

  private async handleIssueLinkedToBranch(
    git: GitService,
    linkedBranch: string,
  ) {
    const shouldCheckOutLinkedBranch = await askCheckOutLinkedBranch()

    if (shouldCheckOutLinkedBranch) {
      await git.checkout(linkedBranch, ["--track"])
      throw new ExitError(0)
    }
  }

  private async resolveIssue(jira: JiraService, projectKey: string) {
    const jql = `
      project = "${projectKey}" AND statusCategory IN (
        ${StatusCategory.ToDo},
        ${StatusCategory.InProgress}
      ) ORDER BY lastViewed DESC
    `

    this.spinner.start()

    const issues = await jira.findIssuesByJql(jql)

    this.spinner.stop()

    const issue = await askIssue(issues)

    return issue
  }

  private async resolveProjectKey(jira: JiraService) {
    let projectKey = this.config.saga.get("project")

    if (!projectKey) {
      this.spinner.start()

      const projects = await jira.listProjects()

      this.spinner.stop()

      if (projects.length === 0) {
        this.log("No projects found.")
        throw new ExitError(1)
      }

      if (projects.length === 1) {
        const project = projects[0]
        projectKey = project.key

        this.log(
          chalk.yellow("!"),
          format(
            "Using %s as project since there are no other projects to choose from.",
            chalk.cyan(projectKey),
          ),
        )
      } else {
        const project = await chooseProject(projects)
        projectKey = project.key
      }
    }

    this.config.saga.set("project", projectKey)

    return projectKey
  }
}
