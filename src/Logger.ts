import { writeFile } from "node:fs/promises"

export class Logger {
  readonly #messages: string[] = []

  constructor(public path: string) {}

  public log(message: string): void {
    this.#messages.push(new Date().toISOString() + "\n" + message)
  }

  public save() {
    return writeFile(this.path, this.#messages.join("\n"))
  }
}
