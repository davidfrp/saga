import { Config as JiraConfig, Version3Client as JiraClient } from "jira.js"
import { Issue } from "jira.js/out/version3/models"
import zod from "zod"
import { JiraUnauthenticatedError } from "./errors.js"

export type JiraServiceOptions = {
  host: string
  email: string
  apiToken: string
  middlewares?: JiraConfig.Middlewares
}

export class JiraService {
  readonly #client: JiraClient
  readonly #colorCache: { [key: string]: string } = {}

  readonly host: string
  readonly email: string

  constructor(options: JiraServiceOptions) {
    const { host, email, apiToken, middlewares } = options

    this.host = host
    this.email = email

    this.#client = new JiraClient({
      host,
      middlewares,
      authentication: {
        basic: {
          email,
          apiToken,
        },
      },
    })
  }

  public fetchAllPages = async <T>(
    fetcher: (startAt: number) => Promise<{
      startAt: number
      maxResults: number
      values: T[]
      isLast?: boolean
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

  isUnauthenticatedError(error: unknown): error is JiraUnauthenticatedError {
    return (
      error !== null &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    )
  }

  public extractIssueKey(projectKey: string, value: string) {
    const keyPattern = new RegExp(`${projectKey}-\\d+`, "i")
    const match = value.match(keyPattern)
    return match ? match[0] : null
  }

  public constructIssueUrl(issue: Issue) {
    return `https://${this.host}/browse/${issue.key}`
  }

  public async colorFromSvg(svgUrl: string) {
    if (this.#colorCache[svgUrl]) {
      return this.#colorCache[svgUrl]
    }

    const response = await fetch(svgUrl)
    const svg = await response.text()
    const color = svg.match(/fill="#([0-9a-f]{6})"/i)?.[1]
    const colorCode = color ? `#${color}` : undefined

    if (colorCode) {
      this.#colorCache[svgUrl] = colorCode
    }

    return colorCode
  }

  public get client() {
    return this.#client
  }

  public getIssueDevStatus = async (issue: Issue) => {
    const devStatusUrl = new URL(`/rest/dev-status/1.0/issue/detail`, this.host)

    devStatusUrl.searchParams.append("issueId", issue.id)
    devStatusUrl.searchParams.append("applicationType", "GitHub")
    devStatusUrl.searchParams.append("dataType", "pullrequest")

    const devStatusSchema = zod.object({
      detail: zod.array(
        zod.object({
          branches: zod.array(
            zod.object({
              name: zod.string(),
              url: zod.string(),
              createPullRequestUrl: zod.string(),
            }),
          ),
          pullRequests: zod.array(
            zod.object({
              name: zod.string(),
              url: zod.string(),
              status: zod.string(),
            }),
          ),
        }),
      ),
    })

    const response = await this.client.sendRequestFullResponse<
      zod.infer<typeof devStatusSchema>
    >({ url: devStatusUrl.toString() })

    return devStatusSchema.parse(response.data)
  }
}
