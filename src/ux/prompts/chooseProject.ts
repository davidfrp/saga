import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Project } from "jira.js/out/version3/models/index.js"
import { createSourceFn } from "../sourceFn.js"

export const chooseProject = async function (
  projects: Project[],
): Promise<Project> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { project } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "project",
      message: "Select a project",
      source: createSourceFn(projects, {
        columns: [
          {
            value: (project) => project.key,
            maxWidth: 10,
          },
          {
            value: (project) => project.name.trim(),
          },
        ],
      }),
    },
  ])

  return project
}
