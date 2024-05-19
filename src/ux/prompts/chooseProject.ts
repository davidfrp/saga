import autocomplete from "inquirer-autocomplete-standalone";
import { Project } from "jira.js/out/version3/models/index.js";
import { createSourceFunction } from "../sourceFunction.js";

export function chooseProject(projects: Project[]) {
  return autocomplete({
    message: "",
    source: createSourceFunction(projects, {
      columns: [
        {
          value: (project) => project.key,
          maxWidth: 10,
        },
        {
          value: (project) => project.name.trim(),
        },
      ],
    }),
  });
}
