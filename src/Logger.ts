import { writeFile } from "node:fs/promises";
import { deansitize } from "./ux/formatting.js";

export class Logger {
  readonly #messages: string[] = [];

  constructor(public path: string) {}

  public log(message: string): void {
    this.#messages.push(`${new Date().toISOString()} ${deansitize(message)}`);
  }

  public save() {
    return writeFile(this.path, this.#messages.join("\n"));
  }
}
