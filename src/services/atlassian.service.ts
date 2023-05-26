import got, { ExtendOptions, Got, Response } from 'got'
import {
  GetProjectsResponse,
  Project,
  GetIssueTransitionsResponse,
  IssueTransition,
  GetUserResponse,
  User,
  SearchIssuesResponse,
  SearchIssueResponse,
  Issue,
} from '../@types/atlassian'

type PaginatedResponse = Response<unknown> & {
  body: {
    nextPage?: string
    values: unknown[]
  }
}

type AtlassianServiceOptions = {
  jiraHostname: string
  email: string
  token: string
}

export default class AtlassianService {
  private client: Got
  private jiraHostname: string

  constructor({ jiraHostname, email, token }: AtlassianServiceOptions) {
    const options: ExtendOptions = {
      prefixUrl: `https://${jiraHostname}/rest/api/3`,
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString(
          'base64',
        )}`,
      },
      responseType: 'json',
    }

    this.client = got.extend(options)
    this.jiraHostname = jiraHostname

    // TODO Handle missing internet connection.
    // RequestError: getaddrinfo ENOTFOUND jiradrdk.atlassian.net
    // Code: ENOTFOUND
  }

  private paginate(response: Response) {
    const { nextPage } = (response as PaginatedResponse).body

    if (nextPage) {
      const { searchParams } = new URL(nextPage)
      return {
        searchParams,
      }
    }

    return false
  }

  async getProjects(): Promise<Project[]> {
    const projects = this.client.paginate<GetProjectsResponse>(
      'project/search',
      {
        searchParams: {
          orderBy: 'lastIssueUpdatedTime',
        },
        pagination: {
          requestLimit: 10,
          transform: (response) =>
            (response as PaginatedResponse).body.values as Project[],
          paginate: this.paginate,
        },
      },
    )

    const allProjects: Project[] = []
    for await (const project of projects) {
      allProjects.push(project)
    }

    return allProjects.map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
    }))
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<GetUserResponse>('myself')
    return {
      id: response.body.accountId,
      email: response.body.emailAddress,
      displayName: response.body.displayName,
    }
  }

  private generateIssueWebUrl(issueKey: string): string {
    return `https://${this.jiraHostname}/browse/${issueKey}`
  }

  private async formatIssueFromResponse(
    issue: SearchIssueResponse,
  ): Promise<Issue> {
    return {
      key: issue.key,
      summary: issue.fields.summary,
      url: this.generateIssueWebUrl(issue.key),
      assignee: issue.fields.assignee && {
        id: issue.fields.assignee.accountId,
        email: issue.fields.assignee.emailAddress,
        displayName: issue.fields.assignee.displayName,
      },
      type: {
        name: issue.fields.issuetype.name,
      },
      status: {
        name: issue.fields.status.name,
        category: issue.fields.status.statusCategory.key,
      },
    }
  }

  async searchIssuesByJql(jql: string): Promise<Issue[]> {
    const { issues } = await this.client
      .get('search', {
        searchParams: {
          jql,
        },
      })
      .json<SearchIssuesResponse>()

    return Promise.all(
      issues.map(async (issue) => this.formatIssueFromResponse(issue)),
    )
  }

  async searchIssue(issueIdOrKey: string): Promise<Issue | null> {
    const issue = await this.client
      .get(`issue/${issueIdOrKey}`)
      .json<SearchIssueResponse>()
      .catch((error) => {
        if (error.response.statusCode === 404) return null
      })

    if (!issue) return null

    return this.formatIssueFromResponse(issue)
  }

  async getIssueTransitions(issueIdOrKey: string): Promise<IssueTransition[]> {
    const response = await this.client
      .get(`issue/${issueIdOrKey}/transitions`)
      .json<GetIssueTransitionsResponse>()

    return response.transitions.map((transition) => ({
      id: transition.id,
      name: transition.name,
      description: transition.to.description,
      status: {
        name: transition.to.statusCategory.name,
        category: transition.to.statusCategory.key,
      },
    }))
  }

  async transitionIssue(
    issueIdOrKey: string,
    transitionId: string,
  ): Promise<void> {
    const { statusCode } = await this.client.post(
      `issue/${issueIdOrKey}/transitions`,
      {
        json: {
          transition: {
            id: transitionId,
          },
        },
      },
    )

    if (statusCode !== 204) {
      throw new Error(
        `Failed to transition issue ${issueIdOrKey} to ${transitionId}`,
      )
    }
  }

  async getIssueByBranch(branch: string): Promise<Issue | null> {
    const issueKey = this.getIssueKeyFromBranch(branch)

    if (!issueKey) return null

    return this.searchIssue(issueKey)
  }

  getIssueKeyFromBranch(branch: string): string | null {
    return branch.match(/\p{Lu}+-\d+/u)?.[0] ?? null
  }
}
