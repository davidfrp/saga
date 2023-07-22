import { Command } from "@oclif/core"
import { CommandError } from "@oclif/core/lib/interfaces/errors.js"
import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import shelljs, { ExecOutputReturnValue } from "shelljs"
import ora, { Ora } from "ora"
import { Store } from "./store/store.js"
import { format } from "node:util"
import { GitServiceError } from "./services/gitService.js"
import { Logger } from "./logger.js"

interface StoreKeys {
  email: string
  jiraHostname: string
  project: string
  baseBranch: string
  workingStatus: string
  readyForReviewStatus: string
  skipConfirmations: string
  branchNameTemplate: string
  branchNamePattern: string
  prTitleTemplate: string
  prTitlePattern: string
  prBodyTemplate: string
  emptyCommitMessageTemplate: string
}

interface AuthStoreKeys {
  atlassianApiToken: string
}

const config = new Store<StoreKeys, AuthStoreKeys>(
  [
    {
      key: "email",
      description: "The email address associated with your Atlassian account.",
    },
    {
      key: "jiraHostname",
      description: "The hostname of your Jira instance.",
    },
    {
      key: "project",
      description: "The project you are currently working on.",
    },
    {
      key: "baseBranch",
      description: "The base branch to use when creating new branches.",
    },
    {
      key: "workingStatus",
      description: "Status to transition to when starting work on an issue.",
    },
    {
      key: "readyForReviewStatus",
      description:
        "Status to transition to when marking an issue as ready for review.",
    },
    {
      key: "skipConfirmations",
      description:
        "Whether to skip confirmation prompts when running commands.",
      defaultValue: "false",
    },
    {
      key: "branchNameTemplate",
      description:
        "Template used to generate default branch names. Uses the doT template engine.",
      defaultValue:
        "feature/{{=issue.key}}-{{=issue.fields.summary.toLowerCase().replace(/[^\\s\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]/gi, '').trim().replace(/\\s+/g, '-')}}",
    },
    {
      key: "branchNamePattern",
      description: "Pattern used to validate branch names.",
    },
    {
      key: "prTitleTemplate",
      description:
        "Template used to generate default pull request titles. Uses the doT template engine.",
      defaultValue:
        "feat: {{=issue.fields.summary.toLowerCase().replace(/[^'\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]+/gi, ' ').trim()}}",
    },
    {
      key: "prTitlePattern",
      description: "Pattern used to validate pull request titles.",
    },
    {
      key: "prBodyTemplate",
      description:
        "Template used to generate default pull request bodies. Uses the doT template engine.",
      defaultValue: "[{{=issue.key}}]({{=issue.url}})",
    },
    {
      key: "emptyCommitMessageTemplate",
      description:
        "Template used to generate default empty commit messages. Uses the doT template engine.",
      defaultValue: "chore: creating pull request",
    },
  ],
  [
    {
      key: "atlassianApiToken",
      description: "The Atlassian API-token used to act on your behalf.",
    },
  ],
)

export abstract class BaseCommand extends Command {
  private spinner: Ora = ora({ spinner: "dots2" })

  get store(): Store<StoreKeys, AuthStoreKeys> {
    return config
  }

  get logger() {
    return Logger
  }

  get action() {
    return {
      wait: (durationInMs: number) => {
        return new Promise((resolve) => setTimeout(resolve, durationInMs))
      },
      start: (message?: string) => {
        this.spinner.stop()
        this.spinner.start(message)
      },
      stop: () => this.spinner.stop(),
      succeed: (message?: string) =>
        this.spinner.stopAndPersist({
          symbol: chalk.green("✓"),
          text: message,
        }),
      fail: (message?: string) => {
        this.spinner.stopAndPersist({
          symbol: chalk.red("✗"),
          text: message,
        })
      },
    }
  }

  exec(command: string): Promise<ExecOutputReturnValue> {
    return new Promise((resolve) => {
      Logger.log(command)
      shelljs.exec(command, { silent: true }, (code, stdout, stderr) => {
        Logger.log(stdout)
        Logger.log(stderr)
        resolve({
          code,
          stdout,
          stderr,
        })
      })
    })
  }

  /**
   * Opens the given URL in the default browser.
   * @param url The URL to open.
   * @returns void
   */
  open(url: URL | string): void {
    let command: string

    switch (process.platform) {
      case "darwin":
        command = `open ${url}`
        break
      case "win32":
        command = `start ${url}`
        break
      default:
        command = `xdg-open ${url}`
        break
    }

    this.exec(command)
  }

  protected async catch(error: CommandError) {
    this.action.stop()

    if (error instanceof GitServiceError) {
      console.log(`\n${chalk.red("✗")} ${error.message}\n`)
      return
    }

    if (error instanceof ExitError) return

    Logger.log(error.stack ?? error.message)
    Logger.persist()

    console.log(
      `\n${chalk.yellow("!")} ${format(
        "Something went wrong. A crash log has been generated.\n  %s",
        Logger.file,
      )}\n`,
    )
  }
}
