import autocomplete from "inquirer-autocomplete-standalone";
import { createSourceFunction } from "../sourceFunction.js";

export function chooseBaseBranch(branches: string[]) {
  return autocomplete({
    message: "Which branch should your pull request merge into?",
    source: createSourceFunction(branches),
  });
}
