import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { createSourceFn } from "../sourceFn.js"

export default async function (branches: string[]): Promise<string> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { startingPoint } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "startingPoint",
      message: "Choose a starting point",
      source: createSourceFn(branches),
    },
  ])

  return startingPoint
}
