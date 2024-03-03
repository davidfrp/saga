import chalk from "chalk"
import { AuthCommand } from "../../AuthCommand.js"

export default class Status extends AuthCommand {
  async run() {
    const atlassianApiToken = await this.config.saga.getSecret(
      "atlassianApiToken",
    )

    if (!atlassianApiToken) {
      this.log(
        chalk.red("✗"),
        "Your Atlassian API-token was not found in keychain.",
      )

      return this.exit(1)
    }

    this.log(atlassianApiToken)
  }
}
