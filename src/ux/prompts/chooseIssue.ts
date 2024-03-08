import chalk from "chalk"
import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"
import { Issue } from "jira.js/out/version3/models/issue.js"
import { JiraService } from "../../services/jira/index.js"
import { createSourceFn } from "../sourceFn.js"

export const chooseIssue = async function (
  jira: JiraService,
  issues: Issue[],
): Promise<Issue> {
  inquirer.registerPrompt("autocomplete", inquirerPrompt)

  const issueTypeColors = await issues.reduce<
    Promise<Record<string, string | undefined>>
  >(async (issueTypeColors, issue) => {
    const colors = await issueTypeColors

    if (issue.fields.issuetype?.iconUrl) {
      colors[issue.key] = await jira.colorFromSvg(
        issue.fields.issuetype.iconUrl,
      )
    }

    return colors
  }, Promise.resolve({}))

  const { issue } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "issue",
      message: "Select an issue",
      source: createSourceFn(issues, {
        meta: (issue) => {
          const meta = [
            issue.fields.issuetype?.name,
            issue.fields.parent?.fields.summary,
            issue.fields.parent?.key,
          ]

          return meta.filter(Boolean).join(" ")
        },
        columns: [
          {
            value: (issue) => {
              return chalk.hex(issueTypeColors[issue.key] ?? "")(issue.key)
            },
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
