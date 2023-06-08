import { format } from "util"
import chalk from "chalk"
import {
  askLoginAgain,
  askEmail,
  askHostname,
  askToken,
} from "../../prompts/index.js"
import { BaseCommand } from "../../baseCommand.js"
import JiraService from "../../services/jiraService.js"

export default class Login extends BaseCommand {
  static flags = {}

  static args = {}

  async run(): Promise<void> {
    let email = this.store.get("email")
    let host = this.store.get("jiraHostname")
    let token = await this.store.secrets.get("atlassianApiToken")

    const hasAllCredentials = email && host && token

    let shouldReauthenticate = false

    if (hasAllCredentials) {
      shouldReauthenticate = await askLoginAgain()

      if (!shouldReauthenticate) this.exit(0)
    }

    if (!email || shouldReauthenticate) {
      email = await askEmail()
      this.store.set("email", email)
    }

    if (!host || shouldReauthenticate) {
      host = await askHostname()
      this.store.set("jiraHostname", host)
    }

    if (!token || shouldReauthenticate) {
      token = await askToken()
      await this.store.secrets.set("atlassianApiToken", token)
    }

    console.log()

    const jira = new JiraService({
      host,
      email,
      token,
    })

    try {
      const currentUser = await jira.getCurrentUser()

      console.log(
        `${chalk.green("✓")} ${format(
          "You're logged in as %s (%s)",
          chalk.cyan(currentUser.displayName),
          chalk.cyan(currentUser.emailAddress),
        )}\n`,
      )
    } catch (_) {
      console.log(
        `${chalk.red("✗")} ${format(
          "You could not get logged in to %s with the provided credentials.",
          chalk.cyan(host),
        )}\n`,
      )

      this.exit(1)
    }
  }
}
