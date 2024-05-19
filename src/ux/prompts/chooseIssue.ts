import chalk from "chalk";
import autocomplete from "inquirer-autocomplete-standalone";
import { Issue, Document } from "jira.js/out/version3/models/index.js";
import { createSourceFunction } from "../sourceFunction.js";

export async function chooseIssue(
  issues: Issue[],
  colors: Record<string, string>
) {
  function parseJiraDoc(content?: Omit<Document, "version">): string {
    return (
      content?.text ??
      content?.content?.map(parseJiraDoc).join(" ").split("\n").join(" ") ??
      ""
    );
  }

  const issue = await autocomplete({
    message: "Select an issue",
    pageSize: 7,
    source: createSourceFunction(issues, {
      columns: [
        {
          value: (issue) => chalk.hex(colors[issue.key])(issue.key),
        },
        {
          value: (issue) => issue.fields.priority.name ?? chalk.dim("None"),
        },
        {
          value: (issue) => issue.fields.status.name ?? chalk.dim("None"),
          maxWidth: 10,
        },
        {
          value: (issue) => {
            return (
              issue.fields.assignee?.emailAddress?.split("@")[0] ??
              chalk.dim("None")
            );
          },
          maxWidth: 8,
        },
        {
          value: (issue) => issue.fields.summary,
          maxWidth: 50,
        },
      ],
      columnSpacing: 2,
      noSelectionText: chalk.dim(
        "Select none. Begin work unrelated to an issue."
      ),
      describe(issue) {
        const description = parseJiraDoc(issue.fields.description);
        const maxLength = 280;
        const minLength = 5;

        return description.length > maxLength
          ? description.slice(0, maxLength) + "..."
          : description.length > minLength
          ? description
          : "";
      },
    }),
  });

  return issue ?? undefined;
}
