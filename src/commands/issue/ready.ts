import { ux } from '@oclif/core'
import { AuthenticatedCommand } from '../..'
import { AtlassianService, GitService } from '../../services'
import * as chalk from 'chalk'
import { askIssueTransitionTo } from '../../prompts'

export default class Ready extends AuthenticatedCommand {
  static summary = 'Mark an issue as ready for review'

  static examples = ['$ saga issue ready']

  // TODO add --reviewer -r flag.
  static flags = {}

  async run(): Promise<void> {
    const gitService = new GitService()
    gitService.pull()
    gitService.push()

    const pullRequestExist = gitService.doesPullRequestExist()
    if (!pullRequestExist) {
      this.error(chalk.red('Der findes ikke et pull request for denne branch'))
    }

    const hasUncommittedChanges = gitService.hasUncommittedChanges()
    if (hasUncommittedChanges) {
      this.error(chalk.red('Du har ikke committet alle dine ændringer'))
    }

    const atlassianService = new AtlassianService({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      email: this.store.get('email')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jiraHostname: this.store.get('jiraHostname')!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      token: (await this.store.authentication.get('atlassianApiToken'))!,
    })

    // project = "" AND development[pullrequests].all > 0

    const branch = gitService.getCurrentBranch()
    const issue = await atlassianService.getIssueByBranch(branch)

    if (!issue) {
      this.error(`Kunne ikke finde en sag for branchen '${branch}'`)
    }

    const transitions = await atlassianService.getIssueTransitions(issue.key)
    const transition = await askIssueTransitionTo(transitions)

    console.log()
    ux.action.start(`Flytter '${issue.key}' til '${transition.name}'`)
    await atlassianService.transitionIssue(issue.key, transition.id)
    ux.action.stop(chalk.green('✓\n'))

    // TODO ux action on mark as ready.
    // TODO provide links to pull request and issue
    // TODO add --no-open flag to not open browser
    // TODO add --no-push flag to not push
    // TODO add --web flag to open browser

    gitService.markAsReady()
    gitService.viewPullRequestOnWeb()
  }
}
