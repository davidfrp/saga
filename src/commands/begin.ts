import * as chalk from 'chalk'
import * as doT from 'dot'
import { Args, Flags, ux } from '@oclif/core'
import { AuthenticatedCommand } from '..'
import { AtlassianService, GitService } from '../services'
import { Issue, IssueTransition, StatusCategory } from '../@types/atlassian'
import {
  askProject,
  askIssue,
  askBranchName,
  askPullRequestTitle,
  askIssueTransitionTo,
  askPullRequestBody,
  askBaseBranch,
} from '../prompts'
import { format } from 'util'

export default class Begin extends AuthenticatedCommand {
  static summary = 'Start working on an issue'

  static args = {
    id: Args.string({ description: 'Id or key of the issue to work on' }),
  }

  // TODO Add --dry-run, -n flag. This will allow the user to see what will happen without actually doing it.
  // TODO Add --base, -B flag. This will allow the user to select a different base branch than the one stored in the config.
  static flags = {
    project: Flags.boolean({
      char: 'p',
      description: 'Select a different project',
    }),
    web: Flags.boolean({
      char: 'w',
      description: 'Opens the pull request in your browser after creation',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description:
        'Show more information about the process, useful for debugging',
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Begin)

    const git = new GitService({
      verbose: flags.verbose,
    })

    if (git.hasUncommittedChanges()) {
      console.error(
        `${chalk.red(
          '✗',
        )} Commit eller stash dine nuværende ændringer før du påbegynder arbejde på en sag.`,
      )
      this.exit(1)
    }

    const atlassianService = new AtlassianService({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      email: this.store.get('email')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jiraHostname: this.store.get('jiraHostname')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      token: (await this.store.authentication.get('atlassianApiToken'))!,
    })

    let projectKey = this.store.get('project')
    if (!projectKey || flags.project) {
      const projects = await atlassianService.getProjects()

      if (projects.length === 1) {
        projectKey = projects[0].key
        console.log(
          `\n${chalk.yellow('!')} ${format(
            'Using %s as project since there are no other projects to choose from.',
            chalk.cyan(projectKey),
          )}`,
        )
      } else {
        const project = await askProject(projects)
        projectKey = project.key
      }

      this.store.set('project', projectKey)

      if (!flags.project) {
        console.log(
          `\n${format(
            'You can change your project at any time by adding the %s flag',
            chalk.bold('--project'),
          )}`,
        )
      }
    }

    let issue: Issue | null | undefined
    if (args.id) {
      if (!args.id.startsWith(projectKey)) {
        args.id = `${projectKey}-${args.id}`
      }

      issue = await atlassianService.searchIssue(args.id)

      if (!issue) {
        console.warn(
          `\n${chalk.yellow('!')} ${format(
            'Unable to find an issue with id %s',
            chalk.cyan(args.id),
          )}`,
        )
      }
    }

    console.log()

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

      const issues = await atlassianService.searchIssuesByJql(jql)
      issue = await askIssue(issues)
    }

    const transitions = await atlassianService.getIssueTransitions(issue.key)
    const filteredTransitions = transitions.filter(
      (transition) => transition.status.category === StatusCategory.InProgress,
    )

    let transition: IssueTransition | undefined
    const workingStatus = this.store.get('workingStatus')
    if (workingStatus) {
      transition = filteredTransitions.find(
        (transition) => transition.name === workingStatus,
      )
    }

    if (!transition) {
      transition = await askIssueTransitionTo(filteredTransitions)
      this.store.set('workingStatus', transition.name)
    }

    const branchNamePattern = new RegExp(
      this.store.get('branchNamePattern') || '(?:)',
    )
    const branchNameTemplate = this.store.get('branchNameTemplate') || ''
    const defaultBranchName = doT.template(branchNameTemplate, {
      argName: ['issue'],
    })({ issue })

    const branch = await askBranchName(defaultBranchName, (input) => {
      if (!branchNamePattern.test(input)) {
        return `Navnet passer ikke til mønsteret ${chalk.red(
          branchNamePattern,
        )}`
      }

      if (!git.isBranchNameValid(input))
        return 'Det navn ser ikke ud til at være gyldigt'

      if (git.branchExists(input))
        return 'En branch med det navn findes allerede'

      return true
    })

    const popularBaseBranches = git.getPopularBaseBranches()

    const baseBranches = [
      ...new Set([...popularBaseBranches, ...git.getRemoteBranches()]),
    ]

    let baseBranch = this.store.get('baseBranch')
    if (!baseBranch) {
      if (baseBranches.length > 1) {
        baseBranch = await askBaseBranch(baseBranches)
      } else {
        if (baseBranches.length === 1) {
          baseBranch = baseBranches.pop() as string
        } else {
          baseBranch = await git.getCurrentBranch()
        }

        console.log(
          `\n${chalk.yellow('!')} ${format(
            'Using %s as base branch since there are no other branches to choose from.',
            chalk.cyan(baseBranch),
          )}\n`,
        )
      }
    }

    if (git.doesOpenPrExist(branch, baseBranch)) {
      console.error(
        `${chalk.red('✗')} ${format(
          'An open pull request already exists for %s into %s',
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        )}`,
      )
      this.exit(1)
    }

    const prTitlePattern = this.store.get('prTitlePattern') || '(?:)'
    const prTitleTemplate = this.store.get('prTitleTemplate') || ''
    const defaultPrTitle = doT.template(prTitleTemplate, {
      argName: ['issue'],
    })({ issue })

    const pullRequestTitle = await askPullRequestTitle(
      defaultPrTitle,
      new RegExp(prTitlePattern),
    )

    const prBodyTemplate = this.store.get('prBodyTemplate') || ''
    const defaultPrBody = doT.template(prBodyTemplate, {
      argName: ['issue'],
    })({ issue })

    const prBody = defaultPrBody // await askPullRequestBody(defaultPrBody)

    // Submit

    let isReadyForWork = true

    console.log()

    this.spinner.start(format('Switching branch to %s', chalk.cyan(branch)))

    await git.checkoutBranch(baseBranch)
    await git.pull()
    await git.createBranch(branch)
    await git.checkoutBranch(branch)
    await git.setUpstream(branch, 'origin')

    const currentBranch = await git.getCurrentBranch()

    if (branch === currentBranch) {
      this.spinner.succeed(format('Switched branch to %s', chalk.cyan(branch)))
    } else {
      isReadyForWork = false
      this.spinner.fail(
        format('Could not switch branch to %s', chalk.cyan(branch)),
      )
    }

    try {
      this.spinner.start(
        format(
          'Transitioning issue %s to %s',
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )

      if (issue.status.name !== transition.name) {
        await atlassianService.transitionIssue(issue.key, transition.id)
        this.spinner.succeed(
          format(
            'Transitioned issue %s from %s to %s',
            chalk.cyan(issue.key),
            chalk.cyan(issue.status.name),
            chalk.cyan(transition.name),
          ),
        )
      } else {
        this.spinner.succeed(
          format(
            'Skipped transition. Issue %s is already in %s',
            chalk.cyan(issue.key),
            chalk.cyan(transition.name),
          ),
        )
      }
    } catch (error) {
      isReadyForWork = false
      this.spinner.fail(
        format(
          'Could not transition issue %s to %s',
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )
    }

    try {
      this.spinner.start(
        format(
          'Creating pull request for %s into %s',
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )
      await git.createPullRequest(pullRequestTitle, prBody, {
        sourceBranch: branch,
        targetBranch: baseBranch,
        isDraft: true,
      })
      const prUrl = await git.getPullRequestUrl()
      this.spinner.succeed(format('Created pull request %s', prUrl))
      if (flags.web) this.open(prUrl)
    } catch (error) {
      isReadyForWork = false
      this.spinner.fail(
        format(
          'Could not create pull request for %s into %s',
          chalk.cyan(branch),
          chalk.cyan(baseBranch),
        ),
      )
    }

    console.log()

    if (isReadyForWork) {
      console.log(chalk.green('You can now start working on your issue.'))
    } else {
      let message = `${chalk.yellow('!')} Something went wrong.`
      if (!flags.verbose) {
        message += format(
          ' You can run the command with the %s flag to get more information.',
          chalk.bold('--verbose'),
        )
      }

      console.log(message)
    }

    console.log()
  }
}
