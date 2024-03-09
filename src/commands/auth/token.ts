import chalk from "chalk"
import { AuthCommand } from "../../AuthCommand.js"
import { ExitError } from "@oclif/core/lib/errors/index.js"

export default class Token extends AuthCommand {
  async run() {
    const atlassianApiToken = await this.config.saga.secure.getSecret(
      "atlassianApiToken",
    )

    if (!atlassianApiToken) {
      this.log(
        chalk.red("✗"),
        "Your Atlassian API-token was not found in keychain.",
      )

      throw new ExitError(1)
    }

    this.log(atlassianApiToken)
  }
}
