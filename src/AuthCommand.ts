import { CommandError } from "@oclif/core/lib/interfaces/index.js"
import chalk from "chalk"
import { format } from "node:util"
import { BaseCommand } from "./NewBaseCommand.js"
import { GitService, errors } from "./services/git/index.js"
import { JiraService } from "./services/jira/index.js"

export abstract class AuthCommand extends BaseCommand {
  protected async catch(error: CommandError) {
    if (error instanceof errors.GitServiceError) {
      this.log(`\n${chalk.red("✗")} ${error.message}\n`)
      return this.exit(1)
    }

    return super.catch(error)
  }

  protected async init() {
    const authenticated = await this.checkAuthentication()

    if (!authenticated) {
      this.log(
        `\n${chalk.yellow("!")} ${format(
          "This command requires you to be logged in.\n  Run %s to log in.",
          chalk.bold(`${this.config.bin} auth login`),
        )}\n`,
      )

      return this.exit(1)
    }
  }

  protected async checkAuthentication() {
    const email = this.config.saga.get("email")
    const jiraHostname = this.config.saga.get("jiraHostname")
    const atlassianApiToken = await this.config.saga.getSecret(
      "atlassianApiToken",
    )

    const hasAllCredentials = Boolean(
      email && jiraHostname && atlassianApiToken,
    )

    return hasAllCredentials
  }

  public async initGitService() {
    const gitService = new GitService({
      onCommand: (command) => this.logger.log(command),
      onOutput: (output) => this.logger.log(output),
      onError: (error) => this.logger.log(error.stack ?? error.message),
    })

    await gitService.checkRequirements()

    return gitService
  }

  public async initJiraService() {
    const host = this.config.saga.get("jiraHostname")
    const email = this.config.saga.get("email")
    const token = await this.config.saga.getSecret("atlassianApiToken")

    if (!token) {
      throw new Error("Atlassian API-token not found in keychain.")
    }

    return new JiraService({ host, email, token })
  }
}
