import { ExitError } from "@oclif/core/lib/errors/index.js"
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
    this.spinner.start()

    let email = this.config.saga.get("email")
    let host = this.config.saga.get("jiraHostname")
    let token = await this.config.saga.getSecret("atlassianApiToken")

    const hasAllCredentials = email && host && token

    let shouldReauthenticate = false

    if (hasAllCredentials) {
      try {
        const jira = await this.initJiraService()
        await jira.getCurrentUser()

        this.spinner.stop()

        shouldReauthenticate = await askLoginAgain()
      } catch (error) {
        shouldReauthenticate = true
      }

      if (!shouldReauthenticate) {
        throw new ExitError(0)
      }
    }

    this.spinner.stop()

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

    this.spinner.start()

    const jira = await this.initJiraService()

    try {
      const currentUser = await jira.getCurrentUser()

      this.spinner.stop()

      this.log(
        chalk.green("✓"),
        format(
          "You're logged in as %s (%s)\n",
          chalk.cyan(currentUser.displayName),
          chalk.cyan(currentUser.emailAddress),
        ),
      )
    } catch (error) {
      this.spinner.stop()

      this.log(
        chalk.red("✗"),
        format("Was unable to authenticate you with %s\n", chalk.cyan(host)),
      )

      throw new ExitError(1)
    }

    this.config.saga.set("project", "")
    this.config.saga.set("workingStatus", "")
    this.config.saga.set("readyForReviewStatus", "")
  }
}
