import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Transition } from "../@types/atlassian.js"
import { getSourceFn } from "./utils.js"

export default async function (transitions: Transition[]): Promise<Transition> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)
  const { transition } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "transition",
      message: "Select new issue status",
      source: getSourceFn(transitions, {
        columns: ["name"],
      }),
    },
  ])

  return transition
}
