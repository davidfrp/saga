import autocomplete from "inquirer-autocomplete-standalone";
import {
  createSourceFunction,
  type CreateSourceFunctionOptionsWithoutNoSelection,
} from "../sourceFunction.js";

export function chooseChoice<Value extends Record<string, unknown> | string>(
  message: string,
  items: Value[],
  options?: CreateSourceFunctionOptionsWithoutNoSelection<Value>
) {
  return autocomplete({
    message,
    source: createSourceFunction(items, options),
  });
}
