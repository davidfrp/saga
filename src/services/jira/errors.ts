export class JiraUnauthenticatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraUnauthenticatedError";
  }
}
