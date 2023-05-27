import { Flags } from '@oclif/core'
import { AuthenticatedCommand } from '../..'
import { AtlassianService, GitService } from '../../services'
import { askIssueTransitionTo } from '../../prompts'
import * as chalk from 'chalk'
import { format } from 'util'
import { IssueTransition, StatusCategory } from '../../@types/atlassian'

export default class Ready extends AuthenticatedCommand {
  static summary = 'Mark an issue as ready for review'

  static examples = ['$ saga issue ready']

  // TODO add --reviewer -r flag.
  static flags = {
    web: Flags.boolean({
      relationships: [{ flags: ['undo'], type: 'none' }],
      description: 'Open the pull request in your browser',
      default: false,
      char: 'w',
    }),
    undo: Flags.boolean({
      relationships: [{ flags: ['web'], type: 'none' }],
      description: "Undo the 'mark as ready' action",
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Ready)

    const git = new GitService()

    const pullRequestExist = git.doesPullRequestExist()
    if (!pullRequestExist) {
      console.log(`${chalk.red('✗')} There is no pull request for this branch`)
      return this.exit(1)
    }

    const hasUncommittedChanges = git.hasUncommittedChanges()
    if (hasUncommittedChanges) {
      console.log(`${chalk.red('✗')} You have uncommitted changes`)
      return this.exit(1)
    }

    git.pull()
    git.push()

    const atlassianService = new AtlassianService({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      email: this.store.get('email')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jiraHostname: this.store.get('jiraHostname')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      token: (await this.store.authentication.get('atlassianApiToken'))!,
    })

    const branch = await git.getCurrentBranch()
    const issue = await atlassianService.getIssueByBranch(branch)

    if (!issue) {
      console.log(
        format('Could not find an issue for branch %s', chalk.cyan(branch)),
      )
      return this.exit(1)
    }

    const transitions = await atlassianService.getIssueTransitions(issue.key)
    const filteredTransitions = transitions.filter(
      (transition) =>
        transition.status.category === StatusCategory.InProgress ||
        transition.status.category === StatusCategory.Completed,
    )

    let transition: IssueTransition | undefined
    const readyForReviewStatus = this.store.get('readyForReviewStatus')
    if (readyForReviewStatus) {
      transition = filteredTransitions.find(
        (transition) => transition.name === readyForReviewStatus,
      )
    }

    if (!transition) {
      transition = await askIssueTransitionTo(filteredTransitions)

      // TODO ask if the user wants to save this as the default transition
      this.store.set('readyForReviewStatus', transition.name)
    }

    this.spinner.start(
      format(
        'Transitioning %s to %s',
        chalk.cyan(issue.key),
        chalk.cyan(transition.name),
      ),
    )
    try {
      await atlassianService.transitionIssue(issue.key, transition.id)
      this.spinner.succeed()
    } catch (_) {
      this.spinner.fail(
        format(
          'Could not transition %s to %s',
          chalk.cyan(issue.key),
          chalk.cyan(transition.name),
        ),
      )
    }

    this.spinner.start('Marking pull request as ready for review')
    try {
      git.markAsReady()
      this.spinner.succeed('Marked pull request as ready for review')
    } catch (_) {
      this.spinner.fail('Could not mark pull request as ready for review')
    }

    if (flags.web) git.viewPullRequestOnWeb()
  }
}
