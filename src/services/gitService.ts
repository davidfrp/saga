import chalk from "chalk"

export type CreatePullRequestOptions = {
  commitMessage: string
  pushEmptyCommit?: boolean
  isDraft?: boolean
  sourceBranch?: string
  targetBranch?: string
  reviewers?: string[]
}

export type CheckoutOptions = {
  startingPoint?: string
}

const startOfWeek = (date: Date): Date => {
  const dayOfWeek = date.getDay()
  const dayOfMonthToStartOfWeek =
    date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  return new Date(date.setDate(dayOfMonthToStartOfWeek))
}

function sortAndGroup(data: { name: string; date: Date }[]): string[] {
  // Count the frequency of each name in the data
  const nameCounts: Record<string, number> = {}
  for (const { name } of data) {
    nameCounts[name] = (nameCounts[name] || 0) + 1
  }

  // Group the names by week starting date
  const namesByWeek: Record<string, string[]> = {}
  for (const { name, date } of data) {
    const weekStartDate = startOfWeek(date)
    if (!namesByWeek[weekStartDate.toISOString()]) {
      namesByWeek[weekStartDate.toISOString()] = []
    }

    namesByWeek[weekStartDate.toISOString()].push(name)
  }

  // Create a list of unique names, sorted by frequency for each week
  const uniqueNames: string[] = []
  for (const names of Object.values(namesByWeek)) {
    for (const name of names
      .filter((name) => nameCounts[name] > 0 && !uniqueNames.includes(name))
      .sort((a, b) => nameCounts[b] - nameCounts[a]))
      uniqueNames.push(name)
  }

  return uniqueNames
}

export class GitServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GitServiceError"
  }
}

export class GitMissingError extends GitServiceError {
  constructor() {
    super(`Git is not installed
  To install Git, visit https://git-scm.com/book/en/v2/Getting-Started-Installing-Git`)
    this.name = "GitMissingError"
  }
}

export class NotInGitRepositoryError extends GitServiceError {
  constructor() {
    super("Not in a git repository")
    this.name = "NotInGitRepositoryError"
  }
}

export class GitHubCliMissingError extends GitServiceError {
  constructor() {
    super(`GitHub CLI is not installed
  To install GitHub CLI, visit https://cli.github.com/manual/installation`)
    this.name = "GitHubCliMissingError"
  }
}

export class GitHubCliUnauthenticatedError extends GitServiceError {
  constructor() {
    super(`Unable to authenticate with GitHub CLI.
  Check your internet connection and ensure you are logged in by running ${chalk.bold(
    "gh auth status",
  )}`)
    this.name = "GitHubCliNotAuthenticatedError"
  }
}

type Executor = (
  command: string,
) => Promise<{ code: number; stdout: string; stderr: string }>

export type GitServiceOptions = {
  executor: Executor
}

export default class GitService {
  private execute: Executor

  constructor(options: GitServiceOptions) {
    this.execute = options.executor
  }

  async checkRequirements(): Promise<this> {
    if (!(await this.isGitInstalled())) throw new GitMissingError()

    if (!(await this.isInGitRepository())) throw new NotInGitRepositoryError()

    if (!(await this.isGitHubCliInstalled())) throw new GitHubCliMissingError()

    if (!(await this.isGitHubCliAuthenticated()))
      throw new GitHubCliUnauthenticatedError()

    return this
  }

  private async isGitInstalled(): Promise<boolean> {
    const { stdout: gitVersion } = await this.execute("git --version")
    return gitVersion.includes("git version")
  }

  private async isGitHubCliInstalled(): Promise<boolean> {
    const { stdout: githubCliVersion } = await this.execute("gh --version")
    return githubCliVersion.includes("gh version")
  }

  private async isGitHubCliAuthenticated(): Promise<boolean> {
    const { code } = await this.execute("gh auth status")
    return code === 0
  }

  private async isInGitRepository(): Promise<boolean> {
    const { code } = await this.execute("git rev-parse --is-inside-work-tree")
    return code === 0
  }

  // TODO remove this?
  // private getPullRequestUrlInText = (text: string): string | undefined =>
  //   text.match(/https:\/\/github.com\/.*\/pull\/\d+/)?.[0]

  async commit(
    message: string,
    options?: { allowEmpty?: boolean; noVerify?: boolean },
  ): Promise<boolean> {
    const flags: string[] = []

    if (options?.allowEmpty) {
      flags.push("--allow-empty")
    }

    if (options?.noVerify) {
      flags.push("--no-verify")
    }

    const { code } = await this.execute(
      `git commit ${flags.join(" ")} -m "${message}"`,
    )

    return code === 0
  }

  async doesOpenPrExist(head: string, base: string): Promise<boolean> {
    const { stdout: json } = await this.execute(
      `gh pr list --json baseRefName,headRefName,state`,
    )

    const data = JSON.parse(json)

    const openPrExists = Boolean(
      data.find(
        (pr: { baseRefName: string; headRefName: string; state: string }) =>
          pr.baseRefName === base &&
          pr.headRefName === head &&
          pr.state === "OPEN",
      ),
    )

    return openPrExists
  }

  async createPullRequest(
    title: string,
    body: string,
    options: CreatePullRequestOptions,
  ): Promise<void> {
    const branch = options.sourceBranch || (await this.getCurrentBranch())

    const baseBranch = options.targetBranch || branch

    const reviewers = options.reviewers || []

    if (options.pushEmptyCommit) {
      await this.commit(options.commitMessage, {
        allowEmpty: true,
        noVerify: true,
      })
      await this.push()
    }

    const flags: string[] = []

    if (options.isDraft) {
      flags.push("--draft")
    }

    if (reviewers.length > 0) {
      flags.push(`--reviewer ${reviewers.join(" --reviewer ")}`)
    }

    const { code, stderr } = await this.execute(
      `gh pr create --title "${title}" --body "${body}" --base ${baseBranch} --head ${branch} ${flags.join(
        " ",
      )}`,
    )

    if (code !== 0) {
      if (options.isDraft && stderr.toLowerCase().includes("draft")) {
        return this.createPullRequest(title, body, {
          ...options,
          pushEmptyCommit: false,
          isDraft: false,
        })
      }

      throw new Error(stderr)
    }
  }

  async setUpstream(branch: string, remote: string): Promise<void> {
    await this.execute(`git push --set-upstream ${remote} ${branch}`)
  }

  async createBranch(branch: string, startingPoint?: string): Promise<void> {
    await this.execute(`git branch ${branch} ${startingPoint || ""}`)
  }

  async branchExists(branch: string): Promise<boolean> {
    const { stdout: branches } = await this.execute("git branch")
    return Boolean(branches.includes(branch))
  }

  async doesPullRequestExist(branch?: string): Promise<boolean> {
    const { code } = await this.execute(`gh pr view ${branch || ""}`)
    return code === 0
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout: branch } = await this.execute(
      "git rev-parse --abbrev-ref HEAD",
    )
    return branch.trim()
  }

  async getRemoteBranches(): Promise<string[]> {
    const { stdout } = await this.execute("git branch -r")

    const branches = stdout
      .split("\n")
      .map((branch) => branch.trim().replace("origin/", ""))
      .filter((branch) => branch && !branch.includes("->"))

    return branches
  }

  async fetch({ prune }: { prune: boolean }): Promise<void> {
    await this.execute(`git fetch ${prune ? "--prune" : ""}`)
  }

  async checkoutBranch(branch: string): Promise<void> {
    await this.execute(`git checkout ${branch}`)
  }

  async viewPullRequestOnWeb(): Promise<void> {
    await this.execute(`gh pr view --web`)
  }

  async getPullRequestUrl(): Promise<string> {
    const { stdout: json } = await this.execute("gh pr view --json url")
    return JSON.parse(json).url
  }

  async markAsReady(): Promise<void> {
    await this.execute("gh pr ready")
  }

  async markAsDraft(): Promise<void> {
    await this.execute("gh pr ready --undo")
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const { stdout: changes } = await this.execute("git status --porcelain")
    return Boolean(changes)
  }

  async push(): Promise<void> {
    await this.execute("git push")
  }

  async pull(): Promise<void> {
    await this.execute("git pull")
  }

  async isBranchNameValid(branch: string): Promise<boolean> {
    const { code } = await this.execute(
      `git check-ref-format --branch ${branch}`,
    )
    return code === 0
  }

  async getPopularBaseBranches(): Promise<string[]> {
    const { stdout: json } = await this.execute(
      "gh pr list --state all --limit 100 --json baseRefName,mergedAt,updatedAt",
    )

    const pullRequests = JSON.parse(json)

    const branches = pullRequests.map(
      (pullRequest: Record<string, unknown>) => ({
        name: pullRequest.baseRefName,
        date: new Date(
          (pullRequest.mergedAt as string) || (pullRequest.updatedAt as string),
        ),
      }),
    )

    return sortAndGroup(branches)
  }
}
