import { prompt, registerPrompt } from 'inquirer'
import * as inquirerPrompt from 'inquirer-autocomplete-prompt'
import { getSourceFn } from './helpers'
import { IssueTransition } from '../@types/atlassian'

export default async function (
  transitions: IssueTransition[],
): Promise<IssueTransition> {
  registerPrompt('autocomplete', inquirerPrompt)
  const { transitionTo } = await prompt([
    {
      type: 'autocomplete',
      name: 'transitionTo',
      message: 'Select issue status',
      source: getSourceFn(transitions, {
        columns: ['name'],
      }),
    },
  ])

  return transitionTo
}
