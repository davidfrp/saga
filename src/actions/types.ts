export interface ActionSequencerRenderer {
  render(state: ActionSequenceState, title?: string): void;
}

export type ActionSequencerOptions = {
  renderer?: ActionSequencerRenderer;
};

export enum ActionSequenceState {
  /** The sequence is running. */
  Running = "running",
  /** The sequence was skipped. */
  Skipped = "skipped",
  /** The sequence completed without errors. */
  Completed = "completed",
  /** An error was thrown while running the sequence. */
  Failed = "failed",
}

export type ActionSequenceTitleResolver<TContext> = (
  context: TContext
) => Readonly<{ [key in ActionSequenceState]?: string }>;

export type ActionSequence<TContext> = {
  /** Resolves the titles for the sequence. */
  titles: ActionSequenceTitleResolver<TContext>;

  /** Action to perform the sequence. */
  action: Action<TContext>;

  /** Predicate to determine if the sequence should be ignored entirely. */
  ignoreWhen?: (context: TContext) => boolean;

  /** Action to rollback the changes performed. */
  rollback?: Action<TContext>;
};

export type ActionSequenceController = {
  /**
   * Skips the current sequence.
   * @param reason Reason for skipping the sequence. If not provided, the title
   * for the skipped state will be used.
   */
  skip: (reason?: string) => void;
};

export type Action<TContext> = (
  context: TContext,
  sequence: ActionSequenceController
) => Promise<void>;
