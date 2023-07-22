import { writeFile } from "node:fs/promises"
import { homedir } from "node:os"

export default class Logger {
  readonly filePath: string
  private logs: string[] = []

  constructor(fileName?: string) {
    const logName = new Date().toISOString().replace(/:/g, "-") + ".log"
    this.filePath = `${homedir()}/.config/saga/${fileName || logName}`
  }

  log(message: string): void {
    this.logs.push(new Date().toISOString() + "  " + message)
  }

  persist(): void {
    writeFile(this.filePath, this.logs.filter(Boolean).join("\n"))
  }
}
