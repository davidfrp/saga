import { Args } from "@oclif/core"
import { BaseCommand } from "../../baseCommand.js"

export default class Get extends BaseCommand {
  static args = {
    key: Args.string({
      description: "The key of the config option to get.",
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args } = await this.parse(Get)

    let value: string | undefined

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value = this.store.get(args.key as any)
    } catch (_) {
      console.log(`Could not find key '${args.key}'`)
      this.exit(1)
    }

    if (value) console.log(value)
  }
}
