import { SkipActionError } from "./errors.js"
import {
  ActionSequence,
  ActionSequenceController,
  ActionSequenceState,
  ActionSequencerOptions,
  ActionSequencerRenderer,
} from "./types.js"

const DEFAULT_RENDERER: ActionSequencerRenderer = {
  render: (state, title = "") => {
    switch (state) {
      case ActionSequenceState.Running:
        console.log(`Running: ${title}`)
        break
      case ActionSequenceState.Skipped:
        console.log(`Skipped: ${title}`)
        break
      case ActionSequenceState.Completed:
        console.log(`Completed: ${title}`)
        break
      case ActionSequenceState.Failed:
        console.log(`Failed: ${title}`)
        break
      default:
        throw new Error(`Unknown state: ${state}`)
    }
  },
}

export class ActionSequencer<TContext> {
  readonly #renderer: ActionSequencerRenderer
  readonly #sequences: ActionSequence<TContext>[] = []

  public constructor(options?: ActionSequencerOptions) {
    this.#renderer = options?.renderer || DEFAULT_RENDERER
  }

  add(...sequence: ActionSequence<TContext>[]) {
    this.#sequences.push(...sequence)
  }

  async run(context: TContext) {
    const sequenceController: ActionSequenceController = {
      skip: (reason) => {
        throw new SkipActionError(reason)
      },
    }

    for (const sequence of this.#sequences) {
      const titles = sequence.titles(context)

      try {
        this.#renderer.render(ActionSequenceState.Running, titles.running)

        await sequence.action(context, sequenceController)

        this.#renderer.render(ActionSequenceState.Completed, titles.completed)
      } catch (error) {
        if (error instanceof SkipActionError) {
          this.#renderer.render(
            ActionSequenceState.Skipped,
            error.message || titles.skipped,
          )

          continue
        }

        this.#renderer.render(ActionSequenceState.Failed, titles.failed)

        throw error
      }
    }
  }
}
