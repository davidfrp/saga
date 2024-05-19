import autocomplete from "inquirer-autocomplete-standalone";
import type { IssueTransition } from "jira.js/out/version3/models/index.js";
import { createSourceFunction } from "../sourceFunction.js";

export function chooseTransition(transitions: IssueTransition[]) {
  return autocomplete({
    message: "Select new issue status",
    source: createSourceFunction(transitions, {
      columns: [
        {
          value: (transition) => transition.name || transition.id || "",
        },
      ],
    }),
  });
}
