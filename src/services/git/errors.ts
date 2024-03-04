export class GitServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GitServiceError"
  }
}

export class GitHubCliMissingError extends GitServiceError {
  constructor() {
    super(`GitHub CLI is not installed
  To install GitHub CLI, visit https://cli.github.com/manual`)
    this.name = "GitHubCliMissingError"
  }
}

export class GitHubCliUnauthenticatedError extends GitServiceError {
  constructor() {
    super(`Unable to authenticate GitHub CLI.
  Check your internet connection and ensure you are logged into GitHub CLI.`)
    this.name = "GitHubCliUnauthenticatedError"
  }
}

export class GitMissingError extends GitServiceError {
  constructor() {
    super(`Git is not installed
  To install Git, visit https://git-scm.com/book/en/v2/Getting-Started-Installing-Git`)
    this.name = "GitMissingError"
  }
}

export class NoRepositoryError extends GitServiceError {
  constructor() {
    super("Not in a git repository")
    this.name = "NoRepositoryError"
  }
}

export class PullRequestMissingError extends GitServiceError {
  constructor() {
    super(`No pull request found for the current branch.`)
    this.name = "PullRequestMissingError"
  }
}

export class DraftPullRequestNotSupportedError extends GitServiceError {
  constructor() {
    super("Draft pull requests are not supported in this repository")
    this.name = "DraftPullRequestNotSupportedError"
  }
}

export class UncommittedChangesError extends GitServiceError {
  constructor() {
    super(`Uncommitted changes found.
  Commit or stash your changes before continuing.`)
    this.name = "UncommittedChangesError"
  }
}
