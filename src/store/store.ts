import { homedir } from "node:os"
import { dirname } from "node:path"
import * as fs from "node:fs"
import keytar from "keytar"

interface DefaultStoreOptions<T> {
  key: keyof T
  description: string
  defaultValue?: T[keyof T]
}

interface DefaultStore<T> {
  readonly options: DefaultStoreOptions<T>[]

  get(key: keyof T): Promise<T[keyof T]> | T[keyof T]
  set(key: keyof T, value: T[keyof T]): Promise<void> | void
  remove(key: keyof T): Promise<void> | void
}

const validateKeyHasOptions = <T>(
  options: DefaultStoreOptions<T>[],
  key: keyof T,
): boolean => {
  if (!options.find((option) => option.key === key)) {
    throw new Error(`Could not find key: ${String(key)}`)
  }

  return true
}

class AuthStore<T> implements DefaultStore<T> {
  readonly options: DefaultStoreOptions<T>[]

  private service = "saga"

  constructor(options: DefaultStoreOptions<T>[]) {
    this.options = options
  }

  async get(key: keyof T): Promise<T[keyof T]> {
    validateKeyHasOptions(this.options, key)

    const password = await keytar.getPassword(this.service, String(key))
    return (password as T[keyof T]) ?? ("" as T[keyof T])
  }

  async set(key: keyof T, value: T[keyof T]): Promise<void> {
    validateKeyHasOptions(this.options, key)
    await keytar.setPassword(this.service, String(key), String(value))
  }

  async remove(key: keyof T): Promise<void> {
    validateKeyHasOptions(this.options, key)
    await keytar.deletePassword(this.service, String(key))
  }
}

export class Store<StoreOptionsT, AuthStoreOptionsT>
  implements DefaultStore<StoreOptionsT>
{
  readonly options: DefaultStoreOptions<StoreOptionsT>[]

  private readonly file = `${homedir()}/.config/saga/config.json`
  private values: StoreOptionsT

  private authStore: AuthStore<AuthStoreOptionsT>

  constructor(
    options: DefaultStoreOptions<StoreOptionsT>[],
    authOptions?: DefaultStoreOptions<AuthStoreOptionsT>[],
  ) {
    this.options = options
    this.values = this.read()
    this.authStore = new AuthStore<AuthStoreOptionsT>(authOptions ?? [])
  }

  get(key: keyof StoreOptionsT): StoreOptionsT[keyof StoreOptionsT] {
    validateKeyHasOptions(this.options, key)

    const options = this.options.find((option) => option.key === key)

    const value = this.values[key] ?? options?.defaultValue

    return value ?? ("" as StoreOptionsT[keyof StoreOptionsT])
  }

  set(
    key: keyof StoreOptionsT,
    value: StoreOptionsT[keyof StoreOptionsT],
  ): void {
    validateKeyHasOptions(this.options, key)
    this.values[key] = value
    this.write()
  }

  remove(key: keyof StoreOptionsT): void {
    validateKeyHasOptions(this.options, key)
    delete this.values[key]
    this.write()
  }

  get secrets(): AuthStore<AuthStoreOptionsT> {
    return this.authStore
  }

  private read(): StoreOptionsT {
    if (!fs.existsSync(this.file)) {
      fs.mkdirSync(dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, "{}", "utf8")
      return {} as StoreOptionsT
    }

    try {
      const fileContents = fs.readFileSync(this.file, "utf8")
      return JSON.parse(fileContents) as StoreOptionsT
    } catch (error) {
      console.error(`Error loading config file: ${error}`)
      return {} as StoreOptionsT
    }
  }

  private write(): void {
    const data = JSON.stringify(this.values, null, 2)
    fs.writeFileSync(this.file, data, "utf8")
  }
}
