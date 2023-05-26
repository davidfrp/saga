import { BaseCommand } from '.'
import * as chalk from 'chalk'

export default abstract class AuthenticatedCommand extends BaseCommand {
  public async init(): Promise<void> {
    const email = this.store.get('email')
    const jiraHostname = this.store.get('jiraHostname')
    const atlassianApiToken = await this.store.authentication.get(
      'atlassianApiToken',
    )

    const hasAllCredentials = email && jiraHostname && atlassianApiToken

    if (!hasAllCredentials) {
      console.log(`
${chalk.yellow('!')} Denne kommando kræver at du er logget ind.
  Kør ${chalk.bold(`${this.config.bin} auth login`)} for at logge ind.
      `)

      this.exit(1)
    }
  }
}
