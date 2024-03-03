import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Transition } from "../../services/jira/types.js"
import { createSourceFn } from "../sourceFn.js"

export default async function (transitions: Transition[]): Promise<Transition> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { transition } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "transition",
      message: "Select new issue status",
      source: createSourceFn(transitions, {
        columns: [
          {
            value: (transition) => transition.name,
          },
        ],
      }),
    },
  ])

  return transition
}
