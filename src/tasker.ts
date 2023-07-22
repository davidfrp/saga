export enum TaskStatus {
  Running = "running",
  Skipped = "skipped",
  Done = "done",
  Failed = "failed",
}

export type Task<TaskerContext> = {
  titles: { [key in TaskStatus]?: string }
  action: (context: TaskerContext) => Promise<void> | void
  skip?: (context: TaskerContext) => Promise<boolean> | boolean
}

export type TaskerOptions<TaskerContext> = {
  onStatusChange?: {
    [key in TaskStatus]?: (
      task: Task<TaskerContext>,
      context?: TaskerContext,
    ) => void
  }
}

export class Tasker<TaskerContext> {
  constructor(
    private tasks: Task<TaskerContext>[],
    private options?: TaskerOptions<TaskerContext>,
  ) {}

  async run(context: TaskerContext): Promise<void> {
    for (const task of this.tasks) {
      this.options?.onStatusChange?.[TaskStatus.Running]?.(task)

      if (task.skip) {
        const skip = await task.skip(context)

        if (skip) {
          this.options?.onStatusChange?.[TaskStatus.Skipped]?.(task)
          continue
        }
      }

      try {
        await task.action(context)
        this.options?.onStatusChange?.[TaskStatus.Done]?.(task)
      } catch (error) {
        this.options?.onStatusChange?.[TaskStatus.Failed]?.(task)
        throw error
      }
    }
  }
}
