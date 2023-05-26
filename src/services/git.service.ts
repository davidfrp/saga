import { exec, config as shelljsConfig } from 'shelljs'
import * as chalk from 'chalk'

export type CreatePullRequestOptions = {
  isDraft?: boolean
  pushEmptyCommit?: boolean
  sourceBranch?: string
  targetBranch?: string
  remote?: string
  reviewers?: string[]
}

export type CreatePullRequestResponse = {
  /**
   * Whether the pull request is a draft.
   */
  isDraft: boolean
  /**
   * The GitHub url for the pull request.
   */
  url: string
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

export default class GitService {
  constructor() {
    shelljsConfig.silent = true

    if (!this.isGitInstalled())
      throw new Error(
        `Git er ikke installeret.
For at installere Git, følg instruktionerne på https://git-scm.com/book/en/v2/Getting-Started-Installing-Git`,
      )

    if (!this.isGitHubCliInstalled())
      throw new Error(
        `GitHub CLI er ikke installeret.
For at installere GitHub CLI, følg instruktionerne på https://cli.github.com/manual/installation`,
      )

    if (!this.isGitHubCliAuthenticated())
      throw new Error(
        `Det kan ikke bekræftes at du er logget ind på GitHub.
Tjek at du har forbindelse til internettet og er logget ind ved at køre kommandoen ${chalk.bold(
          'gh auth status',
        )}`,
      )
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

  private getPullRequestUrlInText = (text: string): string | undefined =>
    text.match(/https:\/\/github.com\/.*\/pull\/\d+/)?.[0]

  commit(message: string, options: { allowEmpty: boolean }): boolean {
    const { code } = exec(
      `git commit ${options.allowEmpty ? '--allow-empty ' : ''}-m "${message}"`,
    )

    return code === 0
  }

  createPullRequest(
    title: string,
    body: string,
    options: CreatePullRequestOptions,
  ): CreatePullRequestResponse {
    if (this.doesPullRequestExist()) {
      throw new Error(
        'Der findes allerede en pull request for denne branch ind i base branchen.',
      )
    }

    if (options.pushEmptyCommit) {
      this.commit('chore: creating pull request', { allowEmpty: true })
      this.push()
    }

    const branch = options.sourceBranch || this.getCurrentBranch()

    const baseBranch = options.targetBranch || branch

    const remote = options.remote || 'origin'

    const reviewers = options.reviewers || []

    const command = `gh pr create --title "${title}" --body "${body}" ${
      options.isDraft ? '--draft' : ''
    } --base ${baseBranch} --head ${remote}:${branch} ${
      reviewers.length > 0 ? `--reviewer ${reviewers.join(' --reviewer ')}` : ''
    }`

    const { code, stdout, stderr } = exec(command)

    if (
      code !== 0 &&
      stderr.includes('No commits between') &&
      !options.pushEmptyCommit
    ) {
      return this.createPullRequest(title, body, {
        ...options,
        pushEmptyCommit: true,
      })
    }

    if (code !== 0 && options.isDraft) {
      return this.createPullRequest(title, body, {
        ...options,
        isDraft: false,
      })
    }

    const url = this.getPullRequestUrlInText(stdout)

    if (code !== 0 || !url) throw new Error('Kunne ikke oprette pull request.')

    return {
      isDraft: Boolean(options.isDraft),
      url,
    }
  }

  setUpstream(branch: string, remote: string): void {
    exec(`git push --set-upstream ${remote} ${branch}`)
  }

  createBranch(branch: string, startingPoint?: string): boolean {
    const { code } = exec(`git branch ${branch} ${startingPoint}`)
    return code === 0
  }

  branchExists(branch: string): boolean {
    const branches = exec('git branch').stdout
    return Boolean(branches.includes(branch))
  }

  doesPullRequestExist(branch?: string): boolean {
    const { code } = exec(`gh pr view ${branch || ''}`)

    return code === 0
  }

  getCurrentBranch(): string {
    const branch = exec('git rev-parse --abbrev-ref HEAD').stdout

    return branch.trim()
  }

  getRemoteBranches(): string[] {
    const output = exec('git branch -r').stdout

    const branches = output
      .split('\n')
      .map((branch) => branch.trim().replace('origin/', ''))
      .filter((branch) => !branch.includes('->'))

    return branches
  }

  fetch(): void {
    exec('git fetch')
  }

  checkoutBranch(branch: string): boolean {
    const { code } = exec(`git checkout ${branch}`)
    const didCheckout = code === 0
    return didCheckout
  }

  viewPullRequestOnWeb(branch?: string): void {
    if (!branch) branch = this.getCurrentBranch()

    exec(`gh pr view --web --head ${branch}`)
  }

  getPullRequestUrl(): string | undefined {
    const { stdout: output } = exec('gh pr view --json url')
    return this.getPullRequestUrlInText(output)
  }

  markAsReady(): void {
    exec('gh pr ready')
  }

  hasUncommittedChanges(): boolean {
    const changes = exec('git status --porcelain').stdout

    return Boolean(changes)
  }

  push(): boolean {
    const { code } = exec('git push')
    return code === 0
  }

  pull(): boolean {
    const { code } = exec('git pull')
    return code === 0
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
