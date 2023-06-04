import chalk from "chalk"
import { BaseCommand } from "../../baseCommand.js"

export default class Logout extends BaseCommand {
  static flags = {}

  static args = {}

  async run(): Promise<void> {
    this.store.remove("project")
    this.store.remove("email")
    this.store.remove("jiraHostname")
    await this.store.secrets.remove("atlassianApiToken")

    console.log(
      `${chalk.green(
        "✓",
      )} Your login credentials have been removed from config and keychain.`,
    )
  }
}
