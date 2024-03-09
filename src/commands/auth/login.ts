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
import { JiraService } from "../../services/jira/index.js"

export type Credentials = {
  email: string
  host: string
  apiToken: string
}

export default class Login extends AuthCommand {
  public override async run() {
    const jira = await this.initJiraService()

    const credentials = await this.getCredentials()

    const shouldReauthenticate = await this.resolveShouldReauthenticate(
      jira,
      credentials,
    )

    if (!shouldReauthenticate) {
      throw new ExitError(0)
    }

    const { email, host, apiToken } = await this.resolveCredentials()

    await this.handleAuthentication({ email, host, apiToken })
  }

  private async handleAuthentication(credentials: Credentials) {
    const { email, host, apiToken } = credentials

    this.config.saga.set("email", email)
    this.config.saga.set("jiraHostname", host)
    await this.config.saga.secure.setSecret("atlassianApiToken", apiToken)

    const jira = await this.initJiraService()

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

    if (!currentUser) {
      this.log(
        chalk.red("✗"),
        format(
          "Was unable to authenticate you with %s\n",
          chalk.cyan(credentials.host),
        ),
      )

      throw new ExitError(1)
    }

    this.log(
      chalk.green("✓"),
      format(
        "You're logged in as %s (%s)\n",
        chalk.cyan(currentUser.displayName),
        chalk.cyan(currentUser.emailAddress),
      ),
    )

    this.config.saga.set("project", "")
    this.config.saga.set("workingStatus", "")
    this.config.saga.set("readyForReviewStatus", "")
  }

  private async resolveCredentials(): Promise<Credentials> {
    const email = await chooseEmail()
    this.config.saga.set("email", email)

    const host = await chooseHostname()
    this.config.saga.set("jiraHostname", host)

    const apiToken = await chooseToken()
    await this.config.saga.secure.setSecret("atlassianApiToken", apiToken)

    return { email, host, apiToken }
  }

  private async resolveShouldReauthenticate(
    jira: JiraService,
    credentials: Partial<Credentials>,
  ) {
    let shouldReauthenticate = true

    const hasAllCredentials = this.checkHasAllCredentials(credentials)

    if (hasAllCredentials) {
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

      if (currentUser) {
        shouldReauthenticate = await chooseLoginAgain()
      }
    }

    return shouldReauthenticate
  }
}
