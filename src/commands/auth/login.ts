import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import { format } from "util"
import { AuthCommand } from "../../AuthCommand.js"
import {
  chooseEmail,
  chooseHostname,
  chooseLoginAgain,
  chooseToken,
} from "../../ux/prompts/index.js"

export type Credentials = {
  email: string
  host: string
  apiToken: string
}

export default class Login extends AuthCommand {
  protected override async checkHasAllCredentials() {
    return true
  }

  public override async run() {
    let credentials = await this.getCredentials()

    const shouldReauthenticate = await this.resolveShouldReauthenticate(
      credentials,
    )

    if (!shouldReauthenticate) {
      throw new ExitError(0)
    }

    credentials = await this.reauthenticate(credentials)

    this.log()

    const jira = await this.initJiraService()

    try {
      const currentUser = await jira.client.myself.getCurrentUser()

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
        format(
          "Was unable to authenticate you with %s\n",
          chalk.cyan(credentials.host),
        ),
      )

      throw new ExitError(1)
    }

    this.config.saga.set("project", "")
    this.config.saga.set("workingStatus", "")
    this.config.saga.set("readyForReviewStatus", "")
  }

  private async reauthenticate(credentials: Credentials) {
    let { email, host, apiToken } = credentials

    email = await chooseEmail()
    this.config.saga.set("email", email)

    host = await chooseHostname()
    this.config.saga.set("jiraHostname", host)

    apiToken = await chooseToken()
    await this.config.saga.setSecret("atlassianApiToken", apiToken)

    return { email, host, apiToken }
  }

  private async resolveShouldReauthenticate(credentials: Credentials) {
    const { email, host, apiToken } = credentials
    let shouldReauthenticate = true

    if (email && host && apiToken) {
      try {
        const jira = await this.initJiraService()
        await jira.client.myself.getCurrentUser()
        shouldReauthenticate = await chooseLoginAgain()
      } catch (error) {
        shouldReauthenticate = true
      }
    }

    return shouldReauthenticate
  }
}
