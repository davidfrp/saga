import { AuthenticatedCommand } from '../..'
import * as chalk from 'chalk'

export default class Status extends AuthenticatedCommand {
  async run(): Promise<void> {
    const atlassianApiToken = await this.store.authentication.get(
      'atlassianApiToken',
    )

    if (!atlassianApiToken) {
      console.log(
        `${chalk.red(
          '✗',
        )} Dit Atlassian API-token blevet ikke fundet i hovednøglering.`,
      )
      this.exit(1)
    }

    console.log(atlassianApiToken)
  }
}
