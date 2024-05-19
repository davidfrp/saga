import inquirer from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import {
  createSourceFunction,
  type CreateSourceFunctionOptions,
} from "../sourceFunction.js";

export const chooseChoice = async function <
  T extends Record<string, unknown> | string
>(
  message: string,
  items: T[],
  options?: CreateSourceFunctionOptions<T>
): Promise<T> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt);

  const { item } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "item",
      message,
      source: createSourceFunction(items, options),
    },
  ]);

  return item;
};
