import { Args } from "@oclif/core"
import { BaseCommand } from "../../baseCommand.js"

export default class Get extends BaseCommand {
  static args = {
    key: Args.string({
      description: "The key of the config option to get.",
      required: true,
    }),
    value: Args.string({
      description: "The value of the config option to set.",
    }),
  }

  async run(): Promise<void> {
    const { args } = await this.parse(Get)

    const keyExist = Boolean(
      this.store.options.find((option) => option.key === args.key),
    )

    if (!keyExist) {
      this.error(`Could not find key '${args.key}'`)
    }

    if (!args.value) args.value = ""

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.store.set(args.key as any, args.value)
    } catch (_) {
      console.log(`Could not set key '${args.key}'`)
      this.exit(1)
    }
  }
}
