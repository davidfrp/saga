import {Version3Client as JiraClient, Config as JiraConfig} from 'jira.js'
import {Issue} from 'jira.js/out/version3/models/index.js'
import zod from 'zod'

import {JiraUnauthenticatedError} from './errors.js'

export type JiraServiceOptions = {
  apiToken: string
  email: string
  host: string
  middlewares?: JiraConfig.Middlewares
}

export class JiraService {
  readonly email: string

  readonly host: string

  readonly #client: JiraClient

  readonly #colorCache: {[key: string]: string} = {}

  constructor(options: JiraServiceOptions) {
    const {apiToken, email, host, middlewares} = options

    this.host = host
    this.email = email

    this.#client = new JiraClient({
      authentication: {
        basic: {
          apiToken,
          email,
        },
      },
      host,
      middlewares,
    })
  }

  public get client() {
    return this.#client
  }

  public fetchAllPages = async <T>(
    fetcher: (startAt: number) => Promise<{
      isLast?: boolean
      maxResults: number
      startAt: number
      values: T[]
    }>,
  ) => {
    const items: T[] = []
    let startAt = 0
    let page

    do {
      page = await fetcher(startAt)
      items.push(...page.values)
      startAt = page.startAt + page.maxResults
    } while (page.isLast === false || page.values.length === page.maxResults)

    return items
  }

  public getIssueDevStatus = async (issue: Issue) => {
    const devStatusUrl = new URL(`/rest/dev-status/1.0/issue/detail`, this.host)

    devStatusUrl.searchParams.append('issueId', issue.id)
    devStatusUrl.searchParams.append('applicationType', 'GitHub')
    devStatusUrl.searchParams.append('dataType', 'pullrequest')

    const devStatusSchema = zod.object({
      detail: zod.array(
        zod.object({
          branches: zod.array(
            zod.object({
              createPullRequestUrl: zod.string(),
              name: zod.string(),
              url: zod.string(),
            }),
          ),
          pullRequests: zod.array(
            zod.object({
              name: zod.string(),
              status: zod.string(),
              url: zod.string(),
            }),
          ),
        }),
      ),
    })

    const response = await this.client.sendRequestFullResponse<zod.infer<typeof devStatusSchema>>({
      url: devStatusUrl.toString(),
    })

    return devStatusSchema.parse(response.data)
  }

  public async colorFromSvg(svgUrl: string) {
    if (this.#colorCache[svgUrl]) {
      return this.#colorCache[svgUrl]
    }

    const response = await fetch(svgUrl)
    const svg = await response.text()
    const color = svg.match(/fill="#([\da-f]{6})"/i)?.[1]
    const colorCode = color ? `#${color}` : undefined

    if (colorCode) {
      this.#colorCache[svgUrl] = colorCode
    }

    return colorCode
  }

  public constructIssueUrl(issue: Issue) {
    return `https://${this.host}/browse/${issue.key}`
  }

  public extractIssueKey(projectKey: string, value: string) {
    const keyPattern = new RegExp(`${projectKey}-\\d+`, 'i')
    const match = value.match(keyPattern)
    return match ? match[0] : null
  }

  isUnauthenticatedError(error: unknown): error is JiraUnauthenticatedError {
    return error !== null && typeof error === 'object' && 'status' in error && error.status === 401
  }
}
