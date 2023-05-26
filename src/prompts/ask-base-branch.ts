import { prompt, registerPrompt } from 'inquirer'
import * as inquirerPrompt from 'inquirer-autocomplete-prompt'
import { getSourceFn } from './helpers'

export default async function (branches: string[]): Promise<string> {
  registerPrompt('autocomplete', inquirerPrompt)
  const { baseBranch } = await prompt([
    {
      type: 'autocomplete',
      name: 'baseBranch',
      message: 'Vælg base branch',
      source: getSourceFn(branches),
    },
  ])

  return baseBranch
}
