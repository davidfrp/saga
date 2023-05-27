import { prompt, registerPrompt } from 'inquirer'
import * as inquirerPrompt from 'inquirer-autocomplete-prompt'
import * as chalk from 'chalk'
import { getSourceFn } from './helpers'
import { Issue } from '../@types/atlassian'

export default async function (issues: Issue[]): Promise<Issue> {
  registerPrompt('autocomplete', inquirerPrompt)
  const { issue } = await prompt([
    {
      type: 'autocomplete',
      name: 'issue',
      message: 'Hvilken sag vil du arbejde på?',
      source: getSourceFn(issues, {
        columns: [
          'key',
          (issue) => {
            return issue.type.color
              ? chalk.hex(issue.type.color)(issue.type.name)
              : issue.type.name
          },
          (issue) => issue.status.name,
          (issue) => issue.assignee?.displayName || '',
          'summary',
        ],
        columnSpacing: 2,
      }),
    },
  ])

  return issue
}
