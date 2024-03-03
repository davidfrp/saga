import { Command } from "@oclif/core"
import { CommandError } from "@oclif/core/lib/interfaces/errors.js"
import { ExitError } from "@oclif/core/lib/errors/index.js"
import chalk from "chalk"
import shelljs, { ExecOutputReturnValue } from "shelljs"
import ora, { Ora } from "ora"
import { Store } from "./legacyStore.js"
import { format } from "node:util"
import { GitServiceError } from "./legacyGitService.js"

interface StoreKeys {
  email: string
  jiraHostname: string
  project: string
  askForStartingPoint: string
  workingStatus: string
  readyForReviewStatus: string
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
      key: "askForStartingPoint",
      description:
        "Whether to use the same branch as both starting point and base branch.",
      defaultValue: "true",
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

/** @deprecated */
export abstract class LegacyBaseCommand extends Command {
  private spinner: Ora = ora({ spinner: "dots2" })

  /** @deprecated */
  get store(): Store<StoreKeys, AuthStoreKeys> {
    return config
  }

  /** @deprecated */
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
      warn: (message?: string) => {
        this.spinner.stopAndPersist({
          symbol: chalk.yellow("!"),
          text: message,
        })
      },
    }
  }

  /** @deprecated */
  exec(command: string): Promise<ExecOutputReturnValue> {
    return new Promise((resolve) => {
      shelljs.exec(command, { silent: true }, (code, stdout, stderr) => {
        resolve({
          code,
          stdout,
          stderr,
        })
      })
    })
  }

  /**
   * @deprecated
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

    console.log(
      `\n${chalk.yellow("!")} Something went wrong.\n\n${
        error.stack ?? error.message
      }\n`,
    )
  }
}
