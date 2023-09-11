import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { getSourceFn } from "./utils.js"

export default async function (branches: string[]): Promise<string> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)
  const { issue } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "issue",
      message: "Which branch should your pull request merge into?",
      source: getSourceFn(branches),
    },
  ])

  return issue
}
