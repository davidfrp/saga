import keytar from "keytar"
import { readFileSync, writeFileSync } from "node:fs"

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

function isValidJSONValue(value: unknown): value is JSONValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return true
  } else if (Array.isArray(value)) {
    return value.every(isValidJSONValue)
  } else if (typeof value === "object") {
    return Object.values(value).every(isValidJSONValue)
  }

  return false
}

function validateSchemaEntry(entry: unknown): entry is SchemaEntry {
  return (
    entry !== null &&
    typeof entry === "object" &&
    "description" in entry &&
    "value" in entry &&
    isValidJSONValue(entry.value)
  )
}

function validateSchema(schema: unknown): schema is ConfigurationSchema {
  return (
    schema !== null &&
    typeof schema === "object" &&
    Object.values(schema).every(validateSchemaEntry)
  )
}

type Widen<T> = T extends boolean ? boolean : T

export type SchemaEntry = {
  /** Whether the configuration entry is a secret. */
  isSecret?: boolean

  /** A description of the configuration entry. */
  description: string

  /** The value of the configuration entry. */
  value: Widen<JSONValue>
}

export interface ConfigurationSchema {
  [key: string]: SchemaEntry
}

type SecretKey<TSchema extends ConfigurationSchema> = {
  [K in keyof TSchema]: TSchema[K]["isSecret"] extends true ? K : never
}[keyof TSchema]

type NonSecretKey<TSchema extends ConfigurationSchema> = {
  [K in keyof TSchema]: TSchema[K]["isSecret"] extends true ? never : K
}[keyof TSchema]

export function createSchema<TSchema extends ConfigurationSchema>(
  config: TSchema,
): TSchema {
  const isValid = validateSchema(config) // TODO use zod to validate the schema?

  if (!isValid) {
    throw new Error("Invalid configuration schema.")
  }

  return config
}

export class Configuration<TSchema extends ConfigurationSchema> {
  readonly #defaultSchema: TSchema
  readonly #serviceName = "saga"

  constructor(readonly path: string, readonly schema: TSchema) {
    this.#defaultSchema = schema
    this.load()
  }

  public get<K extends NonSecretKey<TSchema>>(
    key: K,
  ): Widen<TSchema[K]["value"]> {
    const value = this.schema[key].value as Widen<TSchema[K]["value"]>
    return value
  }

  public set<K extends NonSecretKey<TSchema>>(
    key: K,
    value: Widen<TSchema[K]["value"]>,
  ) {
    this.schema[key].value = value
    this.save()
  }

  public async getSecret<K extends SecretKey<TSchema>>(
    key: K,
  ): Promise<string> {
    const secret = await keytar.getPassword(this.#serviceName, String(key))
    return secret ?? ""
  }

  public setSecret<K extends SecretKey<TSchema>>(
    key: K,
    value: string,
  ): Promise<void> {
    return keytar.setPassword(this.#serviceName, String(key), value)
  }

  public removeSecret<K extends SecretKey<TSchema>>(key: K) {
    return keytar.deletePassword(this.#serviceName, String(key))
  }

  private load() {
    const data: Record<keyof TSchema, JSONValue> = JSON.parse(
      readFileSync(this.path, "utf-8"),
    )

    for (const key in this.schema) {
      const defaultValue = this.#defaultSchema[key].value

      const newValue = data[key] === undefined ? defaultValue : data[key]

      this.schema[key].value = newValue
    }
  }

  private save() {
    const data = Object.fromEntries(
      Object.entries(this.schema)
        .filter(([, value]) => !value.isSecret)
        .map(([key, value]) => [key, value.value]),
    )

    writeFileSync(this.path, JSON.stringify(data, null, 2))
  }
}
