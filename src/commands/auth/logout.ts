import chalk from "chalk"
import { BaseCommand } from "../../NewBaseCommand.js"

export default class Logout extends BaseCommand {
  async run() {
    this.config.saga.set("project", "")
    this.config.saga.set("email", "")
    this.config.saga.set("jiraHostname", "")

    const successfullyRemovedToken = await this.config.saga.removeSecret(
      "atlassianApiToken",
    )

    if (successfullyRemovedToken) {
      this.log(
        chalk.green("✓"),
        "Your login credentials have been removed from config and keychain.",
      )
    } else {
      this.log(
        chalk.red("✗"),
        "Your login credentials could not be removed from keychain.",
      )
    }
  }
}
