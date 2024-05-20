import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export type SchemaEntry<TValue extends JSONValue> = {
  /** A description of the configuration entry. */
  description: string;

  /** The value of the configuration entry. */
  value?: TValue;
};

export type SchemaTypeDefinition = Record<string, JSONValue>;

export type ConfigurationSchema<TDefinition extends SchemaTypeDefinition> = {
  [TEntry in keyof TDefinition]: SchemaEntry<TDefinition[TEntry]>;
};

export function defineSchema<TEntries extends SchemaTypeDefinition>(
  config: ConfigurationSchema<TEntries>
): ConfigurationSchema<TEntries> {
  return config;
}

export class Configuration<
  TSchema extends ConfigurationSchema<SchemaTypeDefinition>
> {
  readonly #defaultSchema: TSchema;

  constructor(readonly path: string, readonly schema: TSchema) {
    this.#defaultSchema = structuredClone(schema);
    this.load();
  }

  public get<K extends keyof TSchema>(key: K): TSchema[K]["value"] {
    return this.schema[key].value;
  }

  public set<K extends keyof TSchema>(key: K, value: TSchema[K]["value"]) {
    this.schema[key].value = value;
    this.save();
  }

  public clear() {
    for (const key in this.schema) {
      this.schema[key].value = this.#defaultSchema[key].value;
    }

    this.save();
  }

  private load() {
    if (!existsSync(this.path)) {
      mkdirSync(dirname(this.path), { recursive: true });
      this.save();
    }

    const data: Record<keyof TSchema, JSONValue> = JSON.parse(
      readFileSync(this.path, "utf-8")
    );

    for (const key in this.schema) {
      this.schema[key].value = data[key] ?? this.#defaultSchema[key].value;
    }
  }

  private save() {
    const data = Object.fromEntries(
      Object.entries(this.schema).map(([key, value]) => [key, value.value])
    );

    writeFileSync(this.path, JSON.stringify(data, null, 2));
  }
}
