import inquirer from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import {
  createSourceFunction,
  CreateSourceFunctionOptions,
  CreateSourceFunctionOptionsWithNoSelection,
} from "../sourceFunction.js";

function isWithNoSelection<Value>(
  options: CreateSourceFunctionOptions<Value> | undefined
): options is CreateSourceFunctionOptionsWithNoSelection<Value> {
  return options?.noSelectionText !== undefined;
}

export const chooseChoice = async function <
  Value extends Record<string, unknown> | string
>(
  message: string,
  items: Value[],
  options?: CreateSourceFunctionOptions<Value>
): Promise<Value> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt);

  const sourceFunction = isWithNoSelection(options)
    ? createSourceFunction(items, options)
    : createSourceFunction(items, options);

  const { item } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "item",
      message,
      source: sourceFunction,
    },
  ]);

  return item;
};
