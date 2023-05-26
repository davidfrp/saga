import * as chalk from 'chalk'
import * as doT from 'dot'
import { Args, Flags, ux } from '@oclif/core'
import { AuthenticatedCommand } from '../..'
import { AtlassianService, GitService } from '../../services'
import { Issue, IssueTransition, StatusCategory } from '../../@types/atlassian'
import {
  askProject,
  askIssue,
  askBranchName,
  askPullRequestTitle,
  askIssueTransitionTo,
  askPullRequestBody,
  askBaseBranch,
} from '../../prompts'

export default class Work extends AuthenticatedCommand {
  static summary = 'Start working on an issue'

  static examples = ['$ saga issue work-on', '$ saga issue work-on --project']

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
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Work)

    const git = new GitService()

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
      const project = await askProject(projects)
      projectKey = project.key

      this.store.set('project', projectKey)

      if (!flags.project) {
        console.log(
          '\nDu kan til enhver tid skifte dit projekt ved at tilføje flaget ' +
            chalk.bold('--project'),
        )
        await ux.wait(2500)
      }
    }

    let issue: Issue | null | undefined
    if (args.id) {
      if (!args.id.startsWith(projectKey)) {
        args.id = `${projectKey}-${args.id}`
      }

      issue = await atlassianService.searchIssue(args.id)

      if (!issue) {
        console.warn(`
${chalk.yellow('!')} Kunne ikke finde nogen sag med id'et ${chalk.bold(args.id)}
`)
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

    const branchName = await askBranchName(defaultBranchName, (input) => {
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
    const mostPopularBaseBranch = popularBaseBranches[0]

    let baseBranch = flags.base || this.store.get('baseBranch')
    if (!baseBranch || baseBranch !== mostPopularBaseBranch) {
      baseBranch = await askBaseBranch(popularBaseBranches)
      this.store.set('baseBranch', baseBranch)
    }
    doT

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
    const prBody = await askPullRequestBody(defaultPrBody)

    // Submit

    let didIssueTransition,
      isOnNewBranch,
      wasPullRequestCreated = false

    try {
      git.checkoutBranch(baseBranch)
      git.pull()
      git.createBranch(branchName)
      git.checkoutBranch(branchName)
      git.setUpstream(branchName, 'origin')

      if (git.getCurrentBranch() === branchName) isOnNewBranch = true

      git.createPullRequest(pullRequestTitle, prBody, {
        sourceBranch: branchName,
        targetBranch: baseBranch,
        isDraft: true,
      })

      wasPullRequestCreated = true
    } catch (error) {
      console.log(
        `${chalk.red(
          '✗',
        )} Der skete en fejl ved oprettelse af pull requesten. Prøv igen senere.`,
      )
    }

    try {
      atlassianService.transitionIssue(issue.key, transition.id)
      didIssueTransition = true
    } catch (_) {
      console.log(`
${chalk.yellow('!')} Din sags status blev ikke ændret automatisk.
  For at ændre status på din sag skal du selv gå ind på Jira og ændre den:
  ${issue.url}
      `)

      await ux.wait(2500)
    }

    console.log(`
Du kan nu begynde at arbejde på ${chalk.bold(issue.key)}
  ${
    didIssueTransition
      ? `${chalk.green('✓')} Flyttede ${chalk.bold(
          issue.key,
        )} til status ${chalk.bold(transition.name)}`
      : chalk.red('✗') + ' Status ikke ændret'
  }
  ${
    isOnNewBranch
      ? `${chalk.green('✓')} Skiftede til branch ${chalk.bold(branchName)}`
      : chalk.red('✗') + ' Skiftede ikke branch'
  }
  ${
    wasPullRequestCreated
      ? chalk.green('✓') + ' Oprettede pull request'
      : chalk.red('✗') + ' Oprettede ikke pull request'
  }
`)

    if (flags.web) this.open(issue.url)
  }
}
