import chalk from "chalk";
import { format } from "node:util";
import { BaseCommand } from "../../BaseCommand.js";

export default class List extends BaseCommand {
  static override aliases: string[] = ["config:ls"];

  async run() {
    Object.entries(this.config.saga.schema).map(
      ([key, { description, value }]) => {
        this.log(chalk.dim(description));
        this.log(
          `${key}=${chalk.green(
            typeof value === "object"
              ? JSON.stringify(value)
              : value?.toString() ?? ""
          )}`
        );
      }
    );

    this.log(
      chalk.yellow("!"),
      format("You can edit these values in the %s file.", this.config.saga.path)
    );
  }
}
