import chalk from "chalk"
import { format } from "node:util"
import { AuthCommand } from "../../AuthCommand.js"
import { ExitError } from "@oclif/core/lib/errors/index.js"
import { JiraService } from "../../services/jira/index.js"
import { User } from "jira.js/out/version3/models/index.js"

export default class Status extends AuthCommand {
  async run() {
    this.spinner.start()

    const credentials = await this.getCredentials()
    const hasAllCredentials = this.checkHasAllCredentials(credentials)

    let currentUser: User | null = null

    if (hasAllCredentials) {
      const jira = await this.initJiraService()
      currentUser = await this.resolveCurrentUser(jira)
    }

    if (!currentUser) {
      this.log(
        chalk.red("✗"),
        format("Unable to authenticate with %s", chalk.cyan(credentials.host)),
      )

      throw new ExitError(1)
    }

    this.log(
      chalk.green("✓"),
      format(
        "You're logged in as %s (%s)",
        chalk.cyan(currentUser.displayName),
        chalk.cyan(currentUser.emailAddress),
      ),
    )
  }

  private async resolveCurrentUser(jira: JiraService) {
    const currentUser = await jira.client.myself
      .getCurrentUser()
      .catch((error) => {
        this.logger.log(
          typeof error === "string"
            ? error
            : error.stack ?? error.message ?? JSON.stringify(error),
        )
        return null
      })

    return currentUser
  }
}
