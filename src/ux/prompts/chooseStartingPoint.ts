import autocomplete from "inquirer-autocomplete-standalone";
import { createSourceFunction } from "../sourceFunction.js";

export function chooseStartingPoint(branches: string[]) {
  return autocomplete({
    message: "Choose a starting point",
    source: createSourceFunction(branches),
  });
}
