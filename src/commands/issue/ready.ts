import { Flags } from '@oclif/core'
import { AuthenticatedCommand } from '../..'
import { AtlassianService, GitService } from '../../services'
import { askIssueTransitionTo, askOptions } from '../../prompts'
import * as chalk from 'chalk'
import { format } from 'util'
import { IssueTransition, StatusCategory } from '../../@types/atlassian'

export default class Ready extends AuthenticatedCommand {
  static summary = 'Mark an issue as ready for review'

  // TODO add --reviewer -r flag.
  // TODO add --undo flag.
  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description:
        'Show more information about the process, useful for debugging',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Ready)

    const git = new GitService({
      verbose: flags.verbose,
    })

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
      this.store.set('readyForReviewStatus', transition.name)
    }

    let isReadyForReview = true

    this.spinner.start(
      format(
        'Transitioning %s to %s',
        chalk.cyan(issue.key),
        chalk.cyan(transition.name),
      ),
    )
    try {
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
    } catch (_) {
      isReadyForReview = false
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
      isReadyForReview = false
      this.spinner.fail('Could not mark pull request as ready for review')
    }

    if (isReadyForReview) {
      console.log()

      enum OptionMessages {
        Skip = 'Skip',
        OpenIssue = 'Open issue in browser',
        OpenPullRequest = 'Open pull request in browser',
        OpenBoth = 'Open issue and pull request in browser',
      }

      const choice = await askOptions("What's next?", [
        OptionMessages.Skip,
        OptionMessages.OpenIssue,
        OptionMessages.OpenPullRequest,
        OptionMessages.OpenBoth,
      ])

      switch (choice) {
        case OptionMessages.OpenIssue:
          this.open(issue.url)
          break
        case OptionMessages.OpenPullRequest:
          this.open(await git.getPullRequestUrl())
          break
        case OptionMessages.OpenBoth:
          this.open(issue.url)
          this.open(await git.getPullRequestUrl())
          break
      }
    }

    console.log()
  }
}
