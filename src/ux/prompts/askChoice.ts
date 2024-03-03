import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { createSourceFn, SourceFnOptions } from "../sourceFn.js"

export default async function <T extends Record<string, unknown> | string>(
  message: string,
  items: T[],
  options?: SourceFnOptions<T>,
): Promise<T> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { item } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "item",
      message,
      source: createSourceFn(items, options),
    },
  ])

  return item
}
