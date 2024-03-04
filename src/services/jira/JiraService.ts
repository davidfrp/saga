import JiraApi from "jira-client"
import fetch from "node-fetch"
import { DevStatusDetail, Issue, Project, Transition, User } from "./types.js"

export type JiraServiceOptions = {
  host: string
  email: string
  token: string
}

export class JiraService {
  readonly host: string
  readonly email: string

  private readonly api: JiraApi

  constructor(options: JiraServiceOptions) {
    this.host = options.host
    this.email = options.email

    this.api = new JiraApi({
      protocol: "https",
      host: options.host,
      username: options.email,
      password: options.token,
      apiVersion: "3",
      strictSSL: true,
    })
  }

  private colorCache: { [key: string]: string } = {}

  private async colorFromSvg(svgUrl: string) {
    if (this.colorCache[svgUrl]) {
      return this.colorCache[svgUrl]
    }

    const response = await fetch(svgUrl)
    const svg = await response.text()
    const color = svg.match(/fill="#([0-9a-f]{6})"/i)?.[1]
    const colorCode = color ? `#${color}` : undefined

    if (colorCode) {
      this.colorCache[svgUrl] = colorCode
    }

    return colorCode
  }

  private async fillIssue(issue: Issue): Promise<Issue> {
    issue.url = `https://${this.host}/browse/${issue.key}`
    issue.fields.issuetype.color = await this.colorFromSvg(
      issue.fields.issuetype.iconUrl,
    )

    if (issue.fields.lastViewed) {
      issue.fields.lastViewed = new Date(issue.fields.lastViewed)
    }

    if (issue.fields.parent) {
      issue.fields.parent = await this.fillIssue(issue.fields.parent)
    }

    return issue
  }

  // Sorting priority:
  // - sort: lastViewed
  // - group: issue type
  //   - if type is "Bug", "Task", "Spike", "Story", "Subtask", put on top.
  //   - if type is "Epic", put on bottom.
  // - group: assignee
  //   - if assigned to me, put on top
  //   - if assigned to someone else, put on bottom
  //   - if unassigned, put in the middle

  // getDevStatusSummary(issueIdOrKey: string) {
  //   return this.api.getDevStatusSummary(issueIdOrKey)
  // }

  // async getDevStatusDetail(issueIdOrKey: string) {
  //   const details = await (this.api.getDevStatusDetail(
  //     issueIdOrKey,
  //     "GitHub",
  //     "branch",
  //   ) as Promise<{
  //     detail: {
  //       branches: {
  //         name: string
  //         url: string
  //       }[]
  //       pullRequests: {
  //         name: string
  //         url: string
  //         status: string
  //       }[]
  //     }
  //   }>)

  //   return details
  // }

  extractIssueKey(projectKey: string, value: string) {
    const keyPattern = new RegExp(`${projectKey}-\\d+`, "i")
    const match = value.match(keyPattern)
    return match ? match[0] : null
  }

  async getLinkedBranch(issueIdOrKey: string): Promise<string | null> {
    const response = await this.api.getDevStatusDetail(
      issueIdOrKey,
      "GitHub",
      "branch",
    )

    const detail = response.detail.at(0) as DevStatusDetail | undefined
    const branch = detail?.branches.at(0)
    return branch?.name ?? null
  }

  async getCurrentUser(): Promise<User> {
    const user = await this.api.getCurrentUser()

    if (
      "accountId" in user &&
      "emailAddress" in user &&
      "displayName" in user
    ) {
      return user as User
    }

    throw new Error("Unexpected user response")
  }

  listProjects(): Promise<Project[]> {
    return this.api.listProjects() as Promise<Project[]>
  }

  async findIssue(issueIdOrKey: string): Promise<Issue | null> {
    try {
      const response = await this.api.getIssue(issueIdOrKey)
      return this.fillIssue(response as Issue)
    } catch (error) {}
    return null
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
