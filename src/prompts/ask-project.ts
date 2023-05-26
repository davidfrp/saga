import { prompt, registerPrompt } from 'inquirer'
import * as inquirerPrompt from 'inquirer-autocomplete-prompt'
import { getSourceFn } from './helpers'
import { Project } from '../@types/atlassian'

export default async function (projects: Project[]): Promise<Project> {
  registerPrompt('autocomplete', inquirerPrompt)
  const { project } = await prompt([
    {
      type: 'autocomplete',
      name: 'project',
      message: 'Hvilket projekt arbejder du på?',
      source: getSourceFn(projects, {
        columns: ['key', 'name'],
      }),
    },
  ])

  return project
}
