import inquirer from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import { createSourceFunction } from "../sourceFunction.js";

export const chooseStartingPoint = async function (
  branches: string[]
): Promise<string> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt);

  const { startingPoint } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "startingPoint",
      message: "Choose a starting point",
      source: createSourceFunction(branches),
    },
  ]);

  return startingPoint;
};
