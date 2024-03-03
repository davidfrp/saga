import inquirer from "inquirer"
import { deansitize, ellipsize } from "./formatting.js"
import fuzzysort from "fuzzysort"

export type Row<T> = {
  meta: string
  name: string
  value: T
}

export type SourceFn<T> = (
  items: T[],
  input: string | undefined,
) => (Row<T> | inquirer.Separator)[]

export type MetaExtractor<T> = (item: T) => string

export type ColumnValueExtractor<T> = (item: T) => string

export type Column<T> = {
  /**
   * Value to display in the column.
   * @example (item) => item.author.firstName
   */
  value: ColumnValueExtractor<T>

  /**
   * Max width of the column.
   * @default Infinity
   */
  maxWidth?: number
}

export type SourceFnOptions<T> = {
  /**
   * If specified, only values from these keys or
   * column value extractors will be used.
   */
  columns?: Column<T>[]

  /**
   * Amount of spaces between each value.
   * @default 2
   */
  columnSpacing?: number

  /**
   * Provides a string which can be matched against when searching.
   * Could be useful for when wanting to search for a value which is not
   * displayed in any of the columns.
   * @example (item) => item.author.lastName
   */
  meta?: MetaExtractor<T>
}

export function createSourceFn<T extends Record<string, unknown> | string>(
  items: T[],
  options?: SourceFnOptions<T>,
) {
  const sourceFn: SourceFn<T> = (_, input) => {
    const rows = createRows(items, options)
    const filteredRows = filterRows(rows, input)
    return [...filteredRows, new inquirer.Separator()]
  }

  return sourceFn
}

function createColumns<T extends Record<string, unknown> | string>(
  items: T[],
): Column<T>[] {
  if (items.every((item) => typeof item === "string")) {
    return [{ value: (item) => String(item) }]
  }

  return Object.entries(items[0])
    .filter(
      ([, value]) => typeof value === "string" || typeof value === "number",
    )
    .map(
      ([key]): Column<T> => ({
        value: (item) => String((item as Record<string, unknown>)[key]),
      }),
    )
}

function createRows<T extends Record<string, unknown> | string>(
  items: T[],
  options?: SourceFnOptions<T>,
) {
  if (!options?.columns) {
    options = {
      ...options,
      columns: createColumns(items),
    }
  }

  const itemValuesOfItems: string[][] = items.map((item) =>
    options!.columns!.map((column) => column.value(item)),
  )

  const ellipsizedColumnValues: string[][] = itemValuesOfItems.map(
    (itemValues) =>
      itemValues.map((value, columnIndex) =>
        ellipsize(value, options?.columns?.[columnIndex].maxWidth ?? Infinity),
      ),
  )

  const columnWidths: number[] = options?.columns?.map(
    (_column, columnIndex) => {
      const lengthOfLongestValue = ellipsizedColumnValues.reduce(
        (maxLength, itemValues) => {
          const value = itemValues[columnIndex]
          return Math.max(maxLength, deansitize(value).length)
        },
        0,
      )

      return lengthOfLongestValue
    },
  ) ?? [0]

  const rows = items.map((item, itemIndex): Row<T> => {
    const itemValues = itemValuesOfItems[itemIndex]
    const ellipsizedItemValues = ellipsizedColumnValues[itemIndex]
    const paddedItemValues = ellipsizedItemValues.map((value, columnIndex) =>
      value.padEnd(
        columnWidths[columnIndex] + value.length - deansitize(value).length,
      ),
    )

    const displayText = paddedItemValues.join(
      " ".repeat(options?.columnSpacing ?? 2),
    )

    return {
      meta: itemValues.join(" ") + options?.meta?.(item) ?? "",
      name: displayText,
      value: item,
    }
  })

  return rows
}

function filterRows<T>(rows: Row<T>[], input?: string) {
  input = input?.trim()

  if (!input) return rows

  const searchableTargets = rows.map((row) => row.meta)

  const results = fuzzysort.go(input, searchableTargets, { limit: 10 })

  if (results.total === 0) return []

  const filteredRows = results
    .map((result) => rows.find((row) => row.meta === result.target))
    .filter((row): row is Row<T> => Boolean(row))

  return filteredRows
}
