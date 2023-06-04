import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Project } from "../@types/atlassian.js"
import { getSourceFn } from "./utils.js"

export default async function (projects: Project[]): Promise<Project> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)
  const { project } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "project",
      message: "Select a project",
      source: getSourceFn(projects, {
        columns: ["name"],
      }),
    },
  ])

  return project
}
