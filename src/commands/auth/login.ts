import {
  askApiToken,
  askEmail,
  askJiraHostname,
  askLoginAgain,
} from '../../prompts'
import { AtlassianService } from '../../services'
import { BaseCommand } from '../..'
import * as chalk from 'chalk'
import { format } from 'util'

export default class Login extends BaseCommand {
  static flags = {}

  static args = {}

  async run(): Promise<void> {
    let email = this.store.get('email')
    let jiraHostname = this.store.get('jiraHostname')
    let atlassianApiToken = await this.store.authentication.get(
      'atlassianApiToken',
    )

    const hasAllCredentials = email && jiraHostname && atlassianApiToken

    let shouldReauthenticate = false

    if (hasAllCredentials) {
      shouldReauthenticate = await askLoginAgain()

      if (!shouldReauthenticate) this.exit(0)
    }

    if (!email || shouldReauthenticate) {
      email = await askEmail()
      this.store.set('email', email)
    }

    if (!jiraHostname || shouldReauthenticate) {
      jiraHostname = await askJiraHostname()
      this.store.set('jiraHostname', jiraHostname)
    }

    if (!atlassianApiToken || shouldReauthenticate) {
      atlassianApiToken = await askApiToken()
      await this.store.authentication.set(
        'atlassianApiToken',
        atlassianApiToken,
      )
    }

    console.log()

    const atlassianService = new AtlassianService({
      email,
      jiraHostname,
      token: atlassianApiToken,
    })

    try {
      const currentUser = await atlassianService.getCurrentUser()

      console.log(
        `${chalk.green('✓')} ${format(
          'Du er logget ind som %s (%s)',
          chalk.cyan(currentUser.displayName),
          chalk.cyan(currentUser.email),
        )}\n`,
      )
    } catch (_) {
      console.log(
        `${chalk.red('✗')} ${format(
          'Du kunne ikke logges ind på %s med de angivne oplysninger.',
          chalk.cyan(jiraHostname),
        )}\n`,
      )

      // TODO Reset/remove email, jiraHostname, and token.

      this.exit(1)
    }
  }
}
