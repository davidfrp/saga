import shelljs, { ExecOutputReturnValue } from "shelljs"
const { exec, config: shelljsConfig } = shelljs

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

function execAsync(command: string): Promise<ExecOutputReturnValue> {
  return new Promise((resolve) => {
    exec(command, (code, stdout, stderr) => {
      resolve({
        code,
        stdout,
        stderr,
      })
    })
  })
}

export type GitServiceOptions = {
  debug?: boolean
}

export default class GitService {
  constructor(options?: GitServiceOptions) {
    shelljsConfig.silent = !options?.debug
    shelljsConfig.verbose = Boolean(options?.debug)
  }

  async checkRequirements(): Promise<this> {
    if (!(await this.isGitInstalled())) throw new Error("Git is not installed")

    if (!(await this.isInGitRepository()))
      throw new Error("Not in a git repository")

    if (!(await this.isGitHubCliInstalled()))
      throw new Error("GitHub CLI is not installed")

    if (!(await this.isGitHubCliAuthenticated()))
      throw new Error("GitHub CLI is not authenticated")

    return this
  }

  private async isGitInstalled(): Promise<boolean> {
    const { stdout: gitVersion } = await execAsync("git --version")
    return gitVersion.includes("git version")
  }

  private async isGitHubCliInstalled(): Promise<boolean> {
    const { stdout: githubCliVersion } = await execAsync("gh --version")
    return githubCliVersion.includes("gh version")
  }

  private async isGitHubCliAuthenticated(): Promise<boolean> {
    const { code } = await execAsync("gh auth status")
    return code === 0
  }

  private async isInGitRepository(): Promise<boolean> {
    const { code } = await execAsync("git rev-parse --is-inside-work-tree")
    return code === 0
  }

  // TODO remove this?
  // private getPullRequestUrlInText = (text: string): string | undefined =>
  //   text.match(/https:\/\/github.com\/.*\/pull\/\d+/)?.[0]

  async commit(
    message: string,
    options: { allowEmpty: boolean },
  ): Promise<boolean> {
    const { code } = await execAsync(
      `git commit ${options.allowEmpty ? "--allow-empty " : ""}-m "${message}"`,
    )
    return code === 0
  }

  async doesOpenPrExist(head: string, base: string): Promise<boolean> {
    const { stdout: json } = await execAsync(
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
    const branch = options.sourceBranch || this.getCurrentBranch()

    const baseBranch = options.targetBranch || branch

    const reviewers = options.reviewers || []

    if (options.pushEmptyCommit) {
      this.commit(options.commitMessage, { allowEmpty: true })
      this.push()
    }

    const command = `gh pr create --title "${title}" --body "${body}" ${
      options.isDraft ? "--draft" : ""
    } --base ${baseBranch} --head ${branch} ${
      reviewers.length > 0 ? `--reviewer ${reviewers.join(" --reviewer ")}` : ""
    }`

    const { code, stderr } = await execAsync(command)

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
    await execAsync(`git push --set-upstream ${remote} ${branch}`)
  }

  async createBranch(branch: string, startingPoint?: string): Promise<void> {
    await execAsync(`git branch ${branch} ${startingPoint || ""}`)
  }

  async branchExists(branch: string): Promise<boolean> {
    const { stdout: branches } = await execAsync("git branch")
    return Boolean(branches.includes(branch))
  }

  async doesPullRequestExist(branch?: string): Promise<boolean> {
    const { code } = await execAsync(`gh pr view ${branch || ""}`)
    return code === 0
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout: branch } = await execAsync(
      "git rev-parse --abbrev-ref HEAD",
    )
    return branch.trim()
  }

  async getRemoteBranches(): Promise<string[]> {
    const { stdout } = await execAsync("git branch -r")

    const branches = stdout
      .split("\n")
      .map((branch) => branch.trim().replace("origin/", ""))
      .filter((branch) => branch && !branch.includes("->"))

    return branches
  }

  async fetch({ prune }: { prune: boolean }): Promise<void> {
    await execAsync(`git fetch ${prune ? "--prune" : ""}`)
  }

  async checkoutBranch(branch: string): Promise<void> {
    await execAsync(`git checkout ${branch}`)
  }

  async viewPullRequestOnWeb(): Promise<void> {
    await execAsync(`gh pr view --web`)
  }

  async getPullRequestUrl(): Promise<string> {
    const { stdout: json } = await execAsync("gh pr view --json url")
    return JSON.parse(json).url
  }

  async markAsReady(): Promise<void> {
    await execAsync("gh pr ready")
  }

  async markAsDraft(): Promise<void> {
    await execAsync("gh pr ready --undo")
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const { stdout: changes } = await execAsync("git status --porcelain")
    return Boolean(changes)
  }

  async push(): Promise<void> {
    await execAsync("git push")
  }

  async pull(): Promise<void> {
    await execAsync("git pull")
  }

  async isBranchNameValid(branch: string): Promise<boolean> {
    const { code } = await execAsync(`git check-ref-format --branch ${branch}`)
    return code === 0
  }

  async getPopularBaseBranches(): Promise<string[]> {
    const { stdout: json } = await execAsync(
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
