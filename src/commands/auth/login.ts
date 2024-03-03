import chalk from "chalk"
import { format } from "util"
import { AuthCommand } from "../../AuthCommand.js"
import {
  askEmail,
  askHostname,
  askLoginAgain,
  askToken,
} from "../../ux/prompts/index.js"

export default class Login extends AuthCommand {
  protected override async checkAuthentication() {
    return true
  }

  async run() {
    let email = this.config.saga.get("email")
    let host = this.config.saga.get("jiraHostname")
    let token = await this.config.saga.getSecret("atlassianApiToken")

    const hasAllCredentials = email && host && token

    let shouldReauthenticate = false

    if (hasAllCredentials) {
      shouldReauthenticate = await askLoginAgain()

      if (!shouldReauthenticate) {
        return this.exit(0)
      }
    }

    if (!email || shouldReauthenticate) {
      email = await askEmail()
      this.config.saga.set("email", email)
    }

    if (!host || shouldReauthenticate) {
      host = await askHostname()
      this.config.saga.set("jiraHostname", host)
    }

    if (!token || shouldReauthenticate) {
      token = await askToken()
      await this.config.saga.setSecret("atlassianApiToken", token)
    }

    this.log()

    const jira = await this.initJiraService()

    try {
      const currentUser = await jira.getCurrentUser()

      this.log(
        chalk.green("✓"),
        format(
          "You're logged in as %s (%s)\n",
          chalk.cyan(currentUser.displayName),
          chalk.cyan(currentUser.emailAddress),
        ),
      )
    } catch (error) {
      this.log(
        chalk.red("✗"),
        format("Was unable to authenticate you with %s\n", chalk.cyan(host)),
      )

      return this.exit(1)
    }
  }
}
