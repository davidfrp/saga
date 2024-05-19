import inquirer from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import type { IssueTransition } from "jira.js/out/version3/models/index.js";
import { createSourceFunction } from "../sourceFunction.js";

export const chooseTransition = async function (
  transitions: IssueTransition[]
): Promise<IssueTransition> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt);

  const { transition } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "transition",
      message: "Select new issue status",
      source: createSourceFunction(transitions, {
        columns: [
          {
            value: (transition) => transition.name || transition.id || "",
          },
        ],
      }),
    },
  ]);

  return transition;
};
