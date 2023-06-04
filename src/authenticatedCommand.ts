import { format } from "util"
import { BaseCommand } from "./baseCommand.js"
import chalk from "chalk"

export abstract class AuthenticatedCommand extends BaseCommand {
  public async init(): Promise<void> {
    const email = this.store.get("email")
    const jiraHostname = this.store.get("jiraHostname")
    const atlassianApiToken = await this.store.secrets.get("atlassianApiToken")

    const hasAllCredentials = email && jiraHostname && atlassianApiToken

    if (!hasAllCredentials) {
      console.log(
        `\n${chalk.yellow("!")} ${format(
          "This command requires you to be logged in.\n  Run %s to log in.",
          chalk.bold(`${this.config.bin} auth login`),
        )}\n`,
      )

      this.exit(1)
    }
  }
}
