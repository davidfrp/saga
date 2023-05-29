import { Command } from '@oclif/core'
import { exec } from 'shelljs'
import { Store } from './store'
import * as chalk from 'chalk'
import * as ora from 'ora'
import { CommandError } from '@oclif/core/lib/interfaces'
import { ExitError } from '@oclif/core/lib/errors'

export interface StoreKeys {
  email?: string
  jiraHostname?: string
  project?: string
  baseBranch?: string
  workingStatus?: string
  readyForReviewStatus?: string
  branchNameTemplate?: string
  branchNamePattern?: string
  prTitleTemplate?: string
  prTitlePattern?: string
  prBodyTemplate?: string
  emptyCommitMessageTemplate?: string
}

export interface AuthStoreKeys {
  atlassianApiToken?: string
}

const store = new Store<StoreKeys, AuthStoreKeys>(
  [
    {
      key: 'email',
      description: 'The email address associated with your Atlassian account.',
    },
    {
      key: 'jiraHostname',
      description: 'The hostname of your Jira instance.',
    },
    {
      key: 'project',
      description: 'The project you are currently working on.',
    },
    {
      key: 'baseBranch',
      description: 'The base branch to use when creating new branches.',
    },
    {
      key: 'workingStatus',
      description: 'Status to transition to when starting work on an issue.',
    },
    {
      key: 'readyForReviewStatus',
      description:
        'Status to transition to when marking an issue as ready for review.',
    },
    {
      key: 'branchNameTemplate',
      description:
        'Template used to generate default branch names. Uses the doT template engine.',
      defaultValue:
        "feature/{{=issue.key}}-{{=issue.summary.toLowerCase().replace(/[^\\s\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]/gi, '').trim().replace(/\\s+/g, '-')}}",
    },
    {
      key: 'branchNamePattern',
      description: 'Pattern used to validate branch names.',
    },
    {
      key: 'prTitleTemplate',
      description:
        'Template used to generate default pull request titles. Uses the doT template engine.',
      defaultValue:
        "feat: {{=issue.summary.toLowerCase().replace(/[^'\\w\\u00C0-\\u024F\\u1E00-\\u1EFF]+/gi, ' ').trim()}}",
    },
    {
      key: 'prTitlePattern',
      description: 'Pattern used to validate pull request titles.',
    },
    {
      key: 'prBodyTemplate',
      description:
        'Template used to generate default pull request bodies. Uses the doT template engine.',
      defaultValue: '[{{=issue.key}}]({{=issue.url}})',
    },
    {
      key: 'emptyCommitMessageTemplate',
      description:
        'Template used to generate default empty commit messages. Uses the doT template engine.',
      defaultValue: 'chore: creating pull request',
    },
  ],
  [
    {
      key: 'atlassianApiToken',
      description: 'The Atlassian API-token used to act on your behalf.',
    },
  ],
)

export default abstract class BaseCommand extends Command {
  private _spinner: ora.Ora = ora({ spinner: 'dots2' })

  get store(): Store<StoreKeys, AuthStoreKeys> {
    return store
  }

  get spinner() {
    return {
      start: (message?: string) => this._spinner.start(message),
      succeed: (message?: string) =>
        this._spinner.stopAndPersist({
          symbol: chalk.green('✓'),
          text: message,
        }),
      fail: (message?: string) => {
        this._spinner.stopAndPersist({
          symbol: chalk.red('✗'),
          text: message,
        })
      },
    }
  }

  /**
   * Opens the given URL in the default browser.
   * @param url The URL to open.
   * @returns void
   */
  open(url: URL | string): void {
    let command: string

    switch (process.platform) {
      case 'darwin':
        command = `open ${url}`
        break
      case 'win32':
        command = `start ${url}`
        break
      default:
        command = `xdg-open ${url}`
        break
    }

    exec(command, { silent: true })
  }

  // protected async catch(error: CommandError) {
  //   if (error instanceof ExitError) return

  //   console.error(`${chalk.red('✗')} ${error.message}`)
  // }
}
