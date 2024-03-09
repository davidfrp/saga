import { BaseCommand } from "../../BaseCommand.js"

export default class Dot extends BaseCommand {
  static override aliases: string[] = ["help:dotjs", "help:dot.js", "help:doT"]

  async run() {
    this
      .log(`Saga uses doT.js to render templates. This can be useful for providing a custom templates for transforming the default input values. Templates used can be found and modified in the configuraion file.

The following templates can be modified:
- \`branchNameTemplate\`: formats the name of a branch
- \`prTitleTemplate\`: formats the title of a pull request
- \`prBodyTemplate\`: formats the body of a pull request
- \`emptyCommitMessageTemplate\`: formats the message for an empty commit

A context is passed to each template, which is an object which may contain the following properties:
- \`branch\`: available in all templates except \`branchNameTemplate\` for all commands 
- \`issue\`: available in all templates for all commands

The \`branch\` property is a string that contains the name of the new branch. 
The \`issue\` property is an object of the current issue that's being worked on. More information about the issue details can be found in the Jira REST API documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get-response


For simple variable substitution, use the \`{{= }}\` syntax. This will replace the placeholder with the value of the variable from the data object.

EXAMPLE USAGE
  "{{= issue.key }}" will output "SAGA-123"
  "{{= issue.fields.summary }}" will output "Improve template engine documentation within CLI"


For evaluating JavaScript expressions, use the \`{{ }}\` syntax. This allows you to embed arbitrary JavaScript code in your templates.

EXAMPLE USAGE
  "{{= issue.key.toLowerCase() }}" will output "saga-123"
  "{{= issue.fields.summary.toLowerCase().replace(/\\s/g, "-") }}" will output "improve-template-engine-documentation-within-cli"


To learn more about doT.js and its syntax, see: https://github.com/olado/doT`)
  }
}
