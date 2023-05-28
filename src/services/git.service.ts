import { exec, config as shelljsConfig } from 'shelljs'

export type CreatePullRequestOptions = {
  isDraft?: boolean
  pushEmptyCommit?: boolean
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

function execAsync(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (code, output, error) => {
      if (code) {
        reject(new Error(error))
        return
      }

      resolve(output)
    })
  })
}

export type GitServiceOptions = {
  verbose?: boolean
}

export default class GitService {
  constructor(options?: GitServiceOptions) {
    shelljsConfig.silent = !options?.verbose
    shelljsConfig.verbose = Boolean(options?.verbose)

    if (!this.isGitInstalled())
      throw new Error('Git is not installed')

    if (!this.isInGitRepository())
      throw new Error('Not in a git repository')

    if (!this.isGitHubCliInstalled())
      throw new Error('GitHub CLI is not installed')

    if (!this.isGitHubCliAuthenticated())
      throw new Error('GitHub CLI is not authenticated')
  }

  private isGitInstalled(): boolean {
    const gitVersion = exec('git --version').stdout

    return Boolean(gitVersion.includes('git version'))
  }

  private isGitHubCliInstalled(): boolean {
    const githubCliVersion = exec('gh --version').stdout

    return Boolean(githubCliVersion.includes('gh version'))
  }

  private isGitHubCliAuthenticated(): boolean {
    const { code } = exec('gh auth status')
    return code === 0
  }

  private isInGitRepository(): boolean {
    const { code } = exec('git rev-parse --is-inside-work-tree')
    return code === 0
  }

  private getPullRequestUrlInText = (text: string): string | undefined =>
    text.match(/https:\/\/github.com\/.*\/pull\/\d+/)?.[0]

  commit(message: string, options: { allowEmpty: boolean }): boolean {
    const { code } = exec(
      `git commit ${options.allowEmpty ? '--allow-empty ' : ''}-m "${message}"`,
    )

    return code === 0
  }

  doesOpenPrExist(head: string, base: string): boolean {
    const output = exec(
      `gh pr list --json baseRefName,headRefName,state`,
    ).stdout

    const data = JSON.parse(output)

    const openPrExists = Boolean(
      data.find(
        (pr: {
          baseRefName: string
          headRefName: string
          state: string
        }) =>
          pr.baseRefName === base &&
          pr.headRefName === head &&
          pr.state === 'OPEN',
      ),
    )

    return openPrExists
  }

  createPullRequest(
    title: string,
    body: string,
    options: CreatePullRequestOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const branch = options.sourceBranch || this.getCurrentBranch()

      const baseBranch = options.targetBranch || branch

      const reviewers = options.reviewers || []

      if (options.isDraft) {
        this.commit('chore: creating pull request', { allowEmpty: true })
        this.push()
      }

      const command = `gh pr create --title "${title}" --body "${body}" ${options.isDraft ? '--draft' : ''
        } --base ${baseBranch} --head ${branch} ${reviewers.length > 0
          ? `--reviewer ${reviewers.join(' --reviewer ')}`
          : ''
        }`

      exec(command, (_, output, error) => {
        if (options.isDraft && error.toLowerCase().includes('draft')) {
          resolve(
            this.createPullRequest(title, body, {
              ...options,
              isDraft: false,
            }),
          )
          return
        }

        const url = this.getPullRequestUrlInText(output)

        if (!url) {
          reject(new Error('Failed to create pull request'))
          return
        }

        resolve()
      })
    })
  }

  async setUpstream(branch: string, remote: string): Promise<void> {
    await execAsync(`git push --set-upstream ${remote} ${branch}`)
  }

  async createBranch(branch: string, startingPoint?: string): Promise<void> {
    await execAsync(`git branch ${branch} ${startingPoint || ''}`)
  }

  branchExists(branch: string): boolean {
    const branches = exec('git branch').stdout
    return Boolean(branches.includes(branch))
  }

  doesPullRequestExist(branch?: string): boolean {
    const { code } = exec(`gh pr view ${branch || ''}`)

    return code === 0
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await execAsync('git rev-parse --abbrev-ref HEAD')
    return branch.trim()
  }

  getRemoteBranches(): string[] {
    const output = exec('git branch -r').stdout

    const branches = output
      .split('\n')
      .map((branch) => branch.trim().replace('origin/', ''))
      .filter((branch) => branch && !branch.includes('->'))

    return branches
  }

  fetch(): void {
    exec('git fetch')
  }

  async checkoutBranch(branch: string): Promise<void> {
    await execAsync(`git checkout ${branch}`)
  }

  async viewPullRequestOnWeb(): Promise<void> {
    await execAsync(`gh pr view --web`)
  }

  async getPullRequestUrl(): Promise<string> {
    const json = await execAsync('gh pr view --json url')
    return JSON.parse(json).url
  }

  async markAsReady(): Promise<void> {
    await execAsync('gh pr ready')
  }

  async markAsDraft(): Promise<void> {
    await execAsync('gh pr ready --undo')
  }

  hasUncommittedChanges(): boolean {
    const changes = exec('git status --porcelain').stdout

    return Boolean(changes)
  }

  push(): boolean {
    const { code } = exec('git push')
    return code === 0
  }

  async pull(): Promise<void> {
    await execAsync('git pull')
  }

  isBranchNameValid(branch: string): boolean {
    return exec(`git check-ref-format --branch ${branch}`).code === 0
  }

  getPopularBaseBranches(): string[] {
    const output = exec(
      'gh pr list --state all --limit 100 --json baseRefName,mergedAt,updatedAt',
    ).stdout

    const pullRequests = JSON.parse(output)

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
