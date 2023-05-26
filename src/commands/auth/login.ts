import {
  askApiToken,
  askEmail,
  askJiraHostname,
  askLoginAgain,
} from '../../prompts'
import { AtlassianService } from '../../services'
import { BaseCommand } from '../..'
import * as chalk from 'chalk'

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
        `${chalk.green('✓')} Du er logget ind som ${chalk.cyan(
          currentUser.displayName,
        )} (${chalk.cyan(currentUser.email)})\n
Du kan nu bruge ${chalk.bold(
          `${this.config.bin} auth logout`,
        )} for at logge ud.\n`,
      )
    } catch (_) {
      console.log(
        `${chalk.red('✗')} Du kunne ikke logges ind på ${chalk.cyan(
          jiraHostname,
        )} med de angivne oplysninger.
  Hvis problemet fortsætter, kan du prøve at logge ind på ny med ${chalk.bold(
    `${this.config.bin} auth login`,
  )}\n`,
      )

      // TODO Reset/remove email, jiraHostname, and token.

      this.exit(1)
    }
  }
}
