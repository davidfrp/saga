import chalk from "chalk"
import { AuthenticatedCommand } from "../../authenticatedCommand.js"

export default class Status extends AuthenticatedCommand {
  async run(): Promise<void> {
    const atlassianApiToken = await this.store.secrets.get("atlassianApiToken")

    if (!atlassianApiToken) {
      console.log(
        `${chalk.red("✗")} Your Atlassian API-token was not found in keychain.`,
      )
      this.exit(1)
    }

    console.log(atlassianApiToken)
  }
}
