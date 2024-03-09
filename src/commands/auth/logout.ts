import chalk from "chalk"
import { AuthCommand } from "../../AuthCommand.js"

export default class Logout extends AuthCommand {
  async run() {
    this.config.saga.set("project", "")
    this.config.saga.set("workingStatus", "")
    this.config.saga.set("readyForReviewStatus", "")
    this.config.saga.set("email", "")
    this.config.saga.set("jiraHostname", "")

    const successfullyRemovedToken = await this.config.saga.secure.removeSecret(
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
