import { format } from "util"
import JiraApi from "jira-client"
import chalk from "chalk"
import {
  askLoginAgain,
  askEmail,
  askHostname,
  askToken,
} from "../../prompts/index.js"
import { BaseCommand } from "../../baseCommand.js"
import { User } from "../../@types/atlassian.js"

export default class Login extends BaseCommand {
  static flags = {}

  static args = {}

  async run(): Promise<void> {
    let email = this.store.get("email")
    let jiraHostname = this.store.get("jiraHostname")
    let atlassianApiToken = await this.store.secrets.get("atlassianApiToken")

    const hasAllCredentials = email && jiraHostname && atlassianApiToken

    let shouldReauthenticate = false

    if (hasAllCredentials) {
      shouldReauthenticate = await askLoginAgain()

      if (!shouldReauthenticate) this.exit(0)
    }

    if (!email || shouldReauthenticate) {
      email = await askEmail()
      this.store.set("email", email)
    }

    if (!jiraHostname || shouldReauthenticate) {
      jiraHostname = await askHostname()
      this.store.set("jiraHostname", jiraHostname)
    }

    if (!atlassianApiToken || shouldReauthenticate) {
      atlassianApiToken = await askToken()
      await this.store.secrets.set("atlassianApiToken", atlassianApiToken)
    }

    console.log()

    const jira = new JiraApi({
      protocol: "https",
      host: jiraHostname,
      username: email,
      password: atlassianApiToken,
      apiVersion: "3",
      strictSSL: true,
    })

    try {
      const currentUser = (await jira.getCurrentUser()) as User

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
          chalk.cyan(jiraHostname),
        )}\n`,
      )

      this.exit(1)
    }
  }
}
