import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Issue } from "../@types/atlassian.js"
import { getSourceFn } from "./utils.js"

export default async function (issues: Issue[]): Promise<Issue> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)
  const { issue } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "issue",
      message: "Select an issue",
      source: getSourceFn(issues, {
        columns: [
          "key",
          // (issue) => {
          //   return issue.type.color
          //     ? chalk.hex(issue.type.color)(issue.type.name)
          //     : issue.type.name
          // },
          (issue) => issue.fields.issuetype.name,
          (issue) => issue.fields.status.name,
          (issue) => issue.fields.summary,
        ],
        columnSpacing: 2,
      }),
    },
  ])

  return issue
}
