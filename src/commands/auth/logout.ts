import { BaseCommand } from '../..'
import * as chalk from 'chalk'

export default class Logout extends BaseCommand {
  static flags = {}

  static args = {}

  async run(): Promise<void> {
    this.store.remove('email')
    this.store.remove('jiraHostname')
    await this.store.authentication.remove('atlassianApiToken')

    console.log(
      `${chalk.green(
        '✓',
      )} Dine loginoplysninger er blevet fjernet fra konfiguration og hovednøglering.`,
    )
  }
}
