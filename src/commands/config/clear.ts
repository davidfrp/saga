import chalk from "chalk";
import { BaseCommand } from "../../BaseCommand.js";

export default class Clear extends BaseCommand {
  async run() {
    this.config.saga.clear();
    this.log(chalk.green("✓"), "Cleared the config");
  }
}
