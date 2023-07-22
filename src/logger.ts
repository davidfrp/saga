import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { homedir } from "node:os"

export class Logger {
  static file: string = resolve(homedir(), ".config/saga", "crash.log")

  static readonly logs: string[] = []

  static log(message: string): void {
    if (!message) {
      return
    }

    Logger.logs.push(new Date().toISOString() + "  " + message)
  }

  static persist(): Promise<void> {
    return writeFile(Logger.file, Logger.logs.join("\n"))
  }
}
