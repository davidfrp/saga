import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { getSourceFn } from "./utils.js"

export default async function <T extends Record<string, unknown> | string>(
  message: string,
  items: T[],
): Promise<T> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)
  const { item } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "item",
      message,
      source: getSourceFn(items),
    },
  ])

  return item
}
