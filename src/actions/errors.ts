export class ActionSequencerError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

export class SkipActionError extends ActionSequencerError {
  constructor(reason?: string) {
    super(reason);
  }
}
