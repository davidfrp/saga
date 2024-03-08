import { exec } from "node:child_process"
import { EventEmitter } from "node:events"
import {
  DraftPullRequestNotSupportedError,
  GitHubCliMissingError,
  GitHubCliUnauthenticatedError,
  GitMissingError,
  NoRepositoryError,
  UncommittedChangesError,
} from "./errors.js"

export type FlagOptions = (string | { [key: string]: boolean })[]

export type GitServiceOptions = {
  onCommand?: (command: string) => void
  onOutput?: (output: string) => void
  onError?: (error: Error) => void
}

export class GitService {
  readonly #events: EventEmitter

  constructor(options?: GitServiceOptions) {
    this.#events = new EventEmitter()

    if (options?.onCommand) {
      this.#events.on("command", options.onCommand)
    }

    if (options?.onOutput) {
      this.#events.on("output", options.onOutput)
    }

    if (options?.onError) {
      this.#events.on("error", options.onError)
    }
  }

  async exec(command: string, options?: { throwOnError?: boolean }) {
    this.#events.emit("command", command)

    options = options ?? {
      throwOnError: true,
    }

    return new Promise<{ stderr: string; stdout: string }>(
      (resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            this.#events.emit("error", error)

            if (options?.throwOnError) {
              reject(error)
            }
          }

          this.#events.emit("output", stdout)

          resolve({ stderr, stdout })
        })
      },
    )
  }

  async checkRequirements(): Promise<this> {
    const assertGitReady = async () => {
      if (!(await this.isGitInstalled())) {
        throw new GitMissingError()
      }

      const assertInGitRepository = async () => {
        if (!(await this.isInGitRepository())) {
          throw new NoRepositoryError()
        }
      }

      const assertNoUncommittedChanges = async () => {
        if (await this.hasUncommittedChanges()) {
          throw new UncommittedChangesError()
        }
      }

      return Promise.all([
        assertInGitRepository(),
        assertNoUncommittedChanges(),
      ])
    }

    const assertGitHubCliReady = async () => {
      if (!(await this.isGitHubCliInstalled()))
        throw new GitHubCliMissingError()

      // TODO improve performance of this or delay execution until needed.
      if (!(await this.isGitHubCliAuthenticated()))
        throw new GitHubCliUnauthenticatedError()
    }

    await Promise.all([assertGitReady(), assertGitHubCliReady()])

    return this
  }

  private async isGitInstalled(): Promise<boolean> {
    const { stdout: gitVersion } = await this.exec("git --version")
    return gitVersion.includes("git version")
  }

  private async isInGitRepository(): Promise<boolean> {
    const { stderr } = await this.exec("git rev-parse --is-inside-work-tree", {
      throwOnError: false,
    })

    return !stderr
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const { stdout: changes } = await this.exec("git status --porcelain")
    return Boolean(changes)
  }

  private async isGitHubCliInstalled(): Promise<boolean> {
    const { stdout: githubCliVersion } = await this.exec("gh --version")
    return githubCliVersion.includes("gh version")
  }

  private async isGitHubCliAuthenticated(): Promise<boolean> {
    const { stderr } = await this.exec("gh auth status", {
      throwOnError: false,
    })

    return !stderr
  }

  private getFlags(options?: FlagOptions): string {
    if (!options) {
      return ""
    }

    const flags = options.map((option) => {
      if (typeof option === "string") {
        return option
      }

      return Object.entries(option)
        .map(([flag, value]) => (value ? flag : ""))
        .filter(Boolean)
        .join(" ")
    })

    return flags.join(" ")
  }

  async fetchPullRequestDetails(branch: string) {
    const { stderr, stdout: json } = await this.exec(
      `gh pr view ${branch} --json number,url,title,body,state,baseRefName,headRefName`,
      { throwOnError: false },
    )

    if (stderr) return null

    const data = JSON.parse(json)

    return data as {
      number: number
      url: string
      title: string
      body: string
      state: string
      baseRefName: string
      headRefName: string
    }
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout } = await this.exec("git branch --show-current")
    return stdout.trim()
  }

  async openPullRequestExists(branch: string, baseBranch: string) {
    const { stdout: json } = await this.exec(
      `gh pr list --json baseRefName,headRefName,state`,
    )

    const data = JSON.parse(json)

    const openPrExists = Boolean(
      data.find(
        (pr: { baseRefName: string; headRefName: string; state: string }) =>
          pr.baseRefName === baseBranch &&
          pr.headRefName === branch &&
          pr.state === "OPEN",
      ),
    )

    return openPrExists
  }

  async fetchCurrentLogin() {
    const { stdout: json } = await this.exec("gh api /user")

    const { login } = JSON.parse(json) as { login: string }

    return login
  }

  async listTeamMembers() {
    const { stdout: pullRequestDetailsResponse } = await this.exec(
      "gh pr view --json headRepository,headRepositoryOwner",
    )

    const { headRepository, headRepositoryOwner } = JSON.parse(
      pullRequestDetailsResponse,
    )

    const { stdout: teamMembersResponse } = await this.exec(
      `gh api /orgs/${headRepositoryOwner.login}/teams/${headRepository.name}/members`,
    )

    const teamMembers = JSON.parse(teamMembersResponse) as
      | { login: string }[]
      | { message: string }

    if ("message" in teamMembers || !Array.isArray(teamMembers)) {
      throw new Error("Resource not found")
    }

    const myGitHubLogin = await this.fetchCurrentLogin()

    const teamMembersLogins = teamMembers
      .filter((teamMember) => teamMember.login !== myGitHubLogin)
      .map((teamMember) => teamMember.login)

    return teamMembersLogins
  }

  async listPopularBaseBranches() {
    const { stdout: json } = await this.exec(
      "gh pr list --state all --limit 100 --json baseRefName,mergedAt,updatedAt",
    )

    type PullRequestResponse = {
      baseRefName: string
      updatedAt: string
      mergedAt?: string
    }

    const pullRequests: PullRequestResponse[] = JSON.parse(json)

    const branchOccurrences: Record<string, number> = {}
    for (const { baseRefName: branch } of pullRequests) {
      branchOccurrences[branch] = (branchOccurrences[branch] || 0) + 1
    }

    const getStartOfWeek = (date: Date): Date => {
      const dayOfWeek = date.getDay()

      const dayOfMonthToStartOfWeek =
        date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)

      return new Date(date.setDate(dayOfMonthToStartOfWeek))
    }

    const pullRequestsSortedByOccurrence = pullRequests.sort(
      (a, b) =>
        branchOccurrences[b.baseRefName] - branchOccurrences[a.baseRefName],
    )

    const pullRequestsSortedByWeek = pullRequestsSortedByOccurrence.sort(
      (a, b) =>
        getStartOfWeek(new Date(b.updatedAt)).getTime() -
        getStartOfWeek(new Date(a.updatedAt)).getTime(),
    )

    const popularBranches = Array.from(
      new Set(
        pullRequestsSortedByWeek.map((pullRequest) => pullRequest.baseRefName),
      ),
    )

    return popularBranches
  }

  async createPullRequest(options: FlagOptions) {
    try {
      await this.exec(`gh pr create ${this.getFlags(options)}`)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(
          "Draft pull requests are not supported in this repository.",
        )
      ) {
        throw new DraftPullRequestNotSupportedError()
      }

      throw error
    }
  }

  async getRemoteBranch(branch: string) {
    const { stdout } = await this.exec(
      `git rev-parse --abbrev-ref ${branch}@{upstream}`,
    )

    return stdout.trim()
  }

  async listRemoteBranches() {
    const { stdout } = await this.exec(
      "git branch -r --format='%(refname:short)'",
    )

    const branches = stdout
      .split("\n")
      .map((branch) => branch.trim())
      .filter(Boolean)

    return branches
  }

  async listLocalBranches() {
    const { stdout } = await this.exec("git branch --format='%(refname:short)'")

    const branches = stdout
      .split("\n")
      .map((branch) => branch.trim())
      .filter(Boolean)

    return branches
  }

  async fetchPullRequestUrl() {
    const { stdout: json } = await this.exec("gh pr view --json url")
    return JSON.parse(json).url as string
  }

  async markPullRequestAsReady() {
    await this.exec("gh pr ready")
  }

  async markPullRequestAsDraft() {
    await this.exec("gh pr ready --undo")
  }

  async addReviewers(reviewers: string[]) {
    await this.exec(`gh pr edit --add-reviewer ${reviewers.join(",")}`)
  }

  async removeReviewers(reviewers: string[]) {
    await this.exec(`gh pr edit --remove-reviewer ${reviewers.join(",")}`)
  }

  async isBranchNameValid(branch: string): Promise<boolean> {
    const { stderr } = await this.exec(
      `git check-ref-format --branch ${branch}`,
    )

    return !stderr
  }

  async listRemotes() {
    const { stdout } = await this.exec("git remote")
    return stdout
      .split("\n")
      .map((remote) => remote.trim())
      .filter(Boolean)
  }

  async checkout(options: FlagOptions) {
    await this.exec(`git checkout ${this.getFlags(options)}`)
  }

  async branch(options: FlagOptions) {
    await this.exec(`git branch ${this.getFlags(options)}`)
  }

  async diff(options?: FlagOptions) {
    const { stdout } = await this.exec(`git diff ${this.getFlags(options)}`)
    return stdout
  }

  async commit(message: string, options?: FlagOptions) {
    await this.exec(`git commit -m "${message}" ${this.getFlags(options)}`)
  }

  async push(options?: FlagOptions) {
    await this.exec(`git push ${this.getFlags(options)}`)
  }
}
