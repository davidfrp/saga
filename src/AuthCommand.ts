import { CommandError } from "@oclif/core/lib/interfaces/index.js";
import chalk from "chalk";
import { format } from "node:util";
import { BaseCommand } from "./BaseCommand.js";
import { GitService, errors } from "./services/git/index.js";
import { JiraService } from "./services/jira/index.js";
import { ExitError } from "@oclif/core/lib/errors/index.js";

export interface Credentials {
  email: string;
  host: string;
  apiToken: string;
}

export abstract class AuthCommand extends BaseCommand {
  protected override async catch(error: CommandError) {
    if (error instanceof errors.GitServiceError) {
      this.log(`\n${chalk.red("✗")} ${error.message}\n`);
      throw new ExitError(1);
    }

    return super.catch(error);
  }

  protected override async init() {
    await super.init();

    const credentials = await this.getCredentials();
    const hasAllCredentials = this.checkHasAllCredentials(credentials);

    if (!hasAllCredentials) {
      this.log(
        `\n${chalk.yellow("!")} ${format(
          "This command requires you to be logged in.\n  Run %s to log in.",
          chalk.bold(`${this.config.bin} auth login`)
        )}\n`
      );

      throw new ExitError(1);
    }
  }

  protected checkHasAllCredentials(
    credentials: Partial<Credentials>
  ): credentials is Credentials {
    const { email, host, apiToken } = credentials;

    const hasAllCredentials = Boolean(email && host && apiToken);

    return hasAllCredentials;
  }

  public async initGitService() {
    const gitService = new GitService({
      onCommand: (command) => this.logger.log(command),
      onOutput: (output) => this.logger.log(output),
      onError: (error) => this.logger.log(error.stack ?? error.message),
    });

    await gitService.checkRequirements();

    return gitService;
  }

  protected async getCredentials(): Promise<Partial<Credentials>> {
    const email = this.config.saga.get("email");
    const host = this.config.saga.get("jiraHostname");
    const apiToken = await this.config.saga.secure.getSecret(
      "atlassianApiToken"
    );

    return { email, host, apiToken };
  }

  public async initJiraService() {
    const credentials = await this.getCredentials();
    const hasAllCredentials = this.checkHasAllCredentials(credentials);

    if (!hasAllCredentials) {
      throw new Error("Missing credentials");
    }

    return new JiraService({
      ...credentials,
      middlewares: {
        onError: (error) => {
          this.logger.log(JSON.stringify(error.toJSON()));
        },
      },
    });
  }
}
