import fetch from "node-fetch"
import JiraApi from "jira-client"
import { Issue, Project, Transition, User } from "../@types/atlassian.js"

export type JiraServiceOptions = {
  host: string
  email: string
  token: string
}

export default class JiraService {
  private host: string
  private api: JiraApi

  constructor(options: JiraServiceOptions) {
    this.host = options.host

    this.api = new JiraApi({
      protocol: "https",
      host: options.host,
      username: options.email,
      password: options.token,
      apiVersion: "3",
      strictSSL: true,
    })
  }

  private async colorFromSvg(svgUrl: string) {
    const response = await fetch(svgUrl)
    const svg = await response.text()
    const color = svg.match(/fill="#([0-9a-f]{6})"/i)?.[1]
    return color ? `#${color}` : undefined
  }

  private async fillIssue(issue: Issue): Promise<Issue> {
    issue.url = `https://${this.host}/browse/${issue.key}`
    issue.fields.issuetype.color = await this.colorFromSvg(
      issue.fields.issuetype.iconUrl,
    )
    return issue
  }

  async getCurrentUser(): Promise<User> {
    return this.api.getCurrentUser() as Promise<User>
  }

  async listProjects(): Promise<Project[]> {
    return this.api.listProjects() as Promise<Project[]>
  }

  async findIssue(issueIdOrKey: string): Promise<Issue> {
    const response = await this.api.getIssue(issueIdOrKey)
    return this.fillIssue(response as Issue)
  }

  async findIssuesByJql(jql: string): Promise<Issue[]> {
    const response = await this.api.searchJira(jql)
    return Promise.all(
      response.issues.map((issue: Issue) => this.fillIssue(issue)),
    )
  }

  async listTransitions(issueKeyOrId: string): Promise<Transition[]> {
    const response = await this.api.listTransitions(issueKeyOrId)
    return response.transitions as Transition[]
  }

  async transitionIssue(
    issueKeyOrId: string,
    transitionId: string,
  ): Promise<void> {
    await this.api.transitionIssue(issueKeyOrId, {
      transition: {
        id: transitionId,
      },
    })
  }

  async assignIssue(issueKeyOrId: string, assigneeId: string): Promise<void> {
    await this.api.updateAssigneeWithId(issueKeyOrId, assigneeId)
  }
}
