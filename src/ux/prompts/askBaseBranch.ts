import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { createSourceFn } from "../sourceFn.js"

export default async function (branches: string[]): Promise<string> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { baseBranch } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "issue",
      message: "Which branch should your pull request merge into?",
      source: createSourceFn(branches),
    },
  ])

  return baseBranch
}
