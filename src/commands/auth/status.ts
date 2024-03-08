import chalk from "chalk"
import { format } from "node:util"
import { AuthCommand } from "../../AuthCommand.js"
import { ExitError } from "@oclif/core/lib/errors/index.js"

export default class Status extends AuthCommand {
  public override async checkHasAllCredentials() {
    return true
  }

  async run() {
    this.spinner.start()

    const hasAllCredentials = await super.checkHasAllCredentials()

    if (hasAllCredentials) {
      const jira = await this.initJiraService()

      try {
        const currentUser = await jira.client.myself.getCurrentUser()

        this.log(
          chalk.green("✓"),
          format(
            "You're logged in as %s (%s)",
            chalk.cyan(currentUser.displayName),
            chalk.cyan(currentUser.emailAddress),
          ),
        )

        throw new ExitError(0)
      } catch (error) {
        if (!jira.isUnauthenticatedError(error)) {
          throw error
        }
      }
    }

    this.log(
      chalk.red("✗"),
      format(
        "You're not logged in.\n  Run %s to log in.",
        chalk.bold(`${this.config.bin} auth login`),
      ),
    )

    throw new ExitError(1)
  }
}
