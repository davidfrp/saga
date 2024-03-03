import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import chalk from "chalk"
import { Issue } from "../../services/jira/types.js"
import { createSourceFn } from "../sourceFn.js"

export default async function (issues: Issue[]): Promise<Issue> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const { issue } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "issue",
      message: "Select an issue",
      source: createSourceFn(issues, {
        meta: (issue) => {
          const meta = [
            issue.fields.issuetype.name,
            issue.fields.parent?.fields.summary,
            issue.fields.parent?.key,
          ]

          return meta.filter(Boolean).join(" ")
        },
        columns: [
          {
            value: (issue) => {
              return chalk.hex(issue.fields.issuetype.color ?? "")(issue.key)
            },
          },
          {
            value: (issue) => issue.fields.priority.name,
          },
          {
            value: (issue) => issue.fields.status.name,
            maxWidth: 10,
          },
          {
            value: (issue) => {
              return (
                issue.fields.assignee?.emailAddress.split("@")[0] ??
                chalk.dim("None")
              )
            },
            maxWidth: 8,
          },
          {
            value: (issue) => issue.fields.summary,
            maxWidth: 50,
          },
        ],
      }),
    },
  ])

  return issue
}
