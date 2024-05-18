import { Command, Config } from "@oclif/core";
import { ExitError } from "@oclif/core/lib/errors/index.js";
import { CommandError } from "@oclif/core/lib/interfaces/index.js";
import chalk from "chalk";
import { exec } from "node:child_process";
import { resolve } from "node:path";
import { format } from "node:util";
import ora, { Ora } from "ora";
import { Logger } from "./Logger.js";
import {
  ActionSequenceState,
  ActionSequencer,
  ActionSequencerOptions,
} from "./actions/index.js";
import {
  Configuration,
  SecureConfiguration,
  defineSchema,
} from "./configuration/index.js";

const schemaDefinition = defineSchema<{
  jiraHostname: string;
  email: string;
  project: string;
  askForStartingPoint: boolean;
  workingStatus: string;
  readyForReviewStatus: string;
  branchNameTemplate: string;
  branchNamePattern: string;
  prTitleTemplate: string;
  prTitlePattern: string;
  prBodyTemplate: string;
  emptyCommitMessageTemplate: string;
}>;

const SAGA_CONFIG_SCHEMA = schemaDefinition({
  jiraHostname: {
    description: "The hostname of your Jira instance.",
  },
  email: {
    description: "The email address associated with your Atlassian account.",
  },
  project: {
    description: "The default project to use when creating new issues.",
  },
  askForStartingPoint: {
    description:
      "Whether to use the same branch as both starting point and base branch.",
    value: true,
  },
  workingStatus: {
    description: "Status to transition to when starting work on an issue.",
    value: "",
  },
  readyForReviewStatus: {
    description:
      "Status to transition to when marking an issue as ready for review.",
    value: "",
  },
  branchNameTemplate: {
    description:
      "Template used to generate default branch names. Uses the doT template engine.",
    value:
      "{{= issue ? `feature/${issue.key}-${issue.fields.summary.toLowerCase().replace(/[^\\s\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]/gi, '').trim().replace(/\\s+/g, '-')}` : ''}}",
  },
  branchNamePattern: {
    description:
      "Pattern used to validate branch names. `new RegExp()` is used to parse the string.",
  },
  prTitleTemplate: {
    description:
      "Template used to generate default pull request titles. Uses the doT template engine.",
    value:
      "{{= issue ? `feat: ${issue.fields.summary.toLowerCase().replace(/[^'\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]+/gi, ' ').trim()}` : ''}}",
  },
  prTitlePattern: {
    description:
      "Pattern for validating pull request titles. `new RegExp()` is used to parse the string.",
    value: "",
  },
  prBodyTemplate: {
    description:
      "Template used to generate default pull request bodies. Uses the doT template engine.",
    value:
      "{{= issue ? `[${issue.key}](https://${jiraHostname}/browse/${issue.key})` : ''}}",
  },
  emptyCommitMessageTemplate: {
    description:
      "Template used to generate default empty commit messages. Uses the doT template engine.",
    value: "chore: creating pull request",
  },
});

type SAGA_SECURE_CONFIG_ENTRIES = "atlassianApiToken";

export abstract class BaseCommand extends Command {
  protected readonly logger: Logger;

  readonly #spinner: Ora = ora({ spinner: "dots" });

  public declare config: Config & {
    saga: Configuration<typeof SAGA_CONFIG_SCHEMA> & {
      secure: SecureConfiguration<SAGA_SECURE_CONFIG_ENTRIES>;
    };
  };

  public constructor(argv: string[], config: Config) {
    super(argv, config);

    const sagaCrashLogPath = resolve(config.configDir, "crash.log");
    const sagaConfigPath = resolve(config.configDir, "config.json");

    this.logger = new Logger(sagaCrashLogPath);

    this.config.saga = Object.assign(
      new Configuration(sagaConfigPath, SAGA_CONFIG_SCHEMA),
      {
        secure: new SecureConfiguration(),
      }
    );
  }

  protected override async catch(error: CommandError) {
    this.spinner.stop();

    if (error instanceof ExitError) return;

    this.logger.log(error.stack ?? error.message ?? JSON.stringify(error));
    await this.logger.save();

    this.log(
      `\n${chalk.yellow("!")} ${format(
        "Something went wrong. A crash log has been generated.\n  %s",
        this.logger.path
      )}\n`
    );
  }

  public override log(message?: string, ...args: any[]) {
    this.spinner.stop();
    return super.log(message, ...args);
  }

  public override warn(input: string | Error) {
    this.spinner.stop();
    return super.warn(input);
  }

  public override error(input: string | Error, options?: { code?: string }) {
    this.spinner.stop();
    return super.error(input, options);
  }

  public override exit(code?: number | undefined): never {
    this.spinner.stop();
    return super.exit(code);
  }

  protected async wait(durationInMs: number) {
    await new Promise((resolve) => setTimeout(resolve, durationInMs));
  }

  /**
   * Opens the given URL in the default browser.
   * @param url The URL to open.
   * @returns void
   */
  protected open(url: URL | string) {
    let command: string;

    switch (process.platform) {
      case "darwin":
        command = `open ${url}`;
        break;
      case "win32":
        command = `start ${url}`;
        break;
      default:
        command = `xdg-open ${url}`;
        break;
    }

    exec(command);
  }

  protected get spinner() {
    return {
      start: (message?: string) => {
        this.#spinner.stop();
        this.#spinner.start(message);
      },
      stop: () => {
        this.#spinner.stop();
      },
      stopAndPersist: (options: { symbol: string; message?: string }) => {
        this.#spinner.stopAndPersist({
          symbol: options.symbol,
          text: options.message,
        });
      },
      succeed: (message?: string) => {
        this.#spinner.stopAndPersist({
          symbol: chalk.green("✓"),
          text: message,
        });
      },
      fail: (message?: string) => {
        this.#spinner.stopAndPersist({
          symbol: chalk.red("✗"),
          text: message,
        });
      },
      warn: (message?: string) => {
        this.#spinner.stopAndPersist({
          symbol: chalk.yellow("!"),
          text: message,
        });
      },
    };
  }

  protected initActionSequencer<TContext>(options?: ActionSequencerOptions) {
    return new ActionSequencer<TContext>({
      renderer: {
        render: (state, title) => {
          switch (state) {
            case ActionSequenceState.Running:
              this.spinner.start(title);
              break;
            case ActionSequenceState.Skipped:
              this.spinner.stopAndPersist({
                symbol: chalk.yellow("↓"),
                message: title,
              });
              break;
            case ActionSequenceState.Completed:
              this.spinner.succeed(title);
              break;
            case ActionSequenceState.Failed:
              this.spinner.fail(title);
              break;
            default:
              this.spinner.stop();
              break;
          }
        },
      },
      ...options,
    });
  }
}
