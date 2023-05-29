import { prompt, registerPrompt } from 'inquirer'
import * as inquirerPrompt from 'inquirer-autocomplete-prompt'
import { getSourceFn } from './helpers'

export default async function <T extends string>(
  message: string,
  options: T[],
): Promise<T> {
  registerPrompt('autocomplete', inquirerPrompt)
  const { issue } = await prompt([
    {
      type: 'autocomplete',
      name: 'issue',
      message,
      source: getSourceFn(options),
    },
  ])

  return issue
}
