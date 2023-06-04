import chalk from "chalk"
import { BaseCommand } from "../../baseCommand.js"

export default class List extends BaseCommand {
  static aliases: string[] = ["config:ls"]

  async run(): Promise<void> {
    this.store.options.map((option) => {
      const value = this.store.get(option.key)
      console.log(chalk.dim(option.description))
      console.log(`${option.key}=${chalk.green(value ?? "")}`)
    })
  }
}
