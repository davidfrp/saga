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
   * Display name of the column.
   * @example "Author"
   */
  name?: string

  /**
   * Max width of the column.
   * @default 100
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
   * Provides a string to be used for filtering.
   * This is useful for when you want to search a value that is not displayed.
   * @example (item) => item.author.lastName
   */
  meta?: MetaExtractor<T>
}

function createSourceFn<T extends Record<string, unknown>>(
  items: T[],
  options: SourceFnOptions<T> = {},
): SourceFn<T> {
  const sourceFn: SourceFn<T> = (_, input) => {
    const { columns = [], columnSpacing = 2, meta: metaExtractor } = options
    const rows = createRows(items, columns, columnSpacing, metaExtractor)
    const filteredRows = filterRows(rows, input)
    return [...filteredRows, new inquirer.Separator()]
  }

  return sourceFn
}

function createRows<T extends Record<string, unknown>>(
  items: T[],
  columns: Column<T>[],
  columnSpacing: number,
  metaExtractor?: MetaExtractor<T>,
): Row<T>[] {
  if (columns.length === 0) {
    columns = Object.keys(items[0]).map(
      (key): Column<T> => ({
        value: (item) => String(item[key]),
        name: key,
        maxWidth: 100,
      }),
    )
  }

  const itemValuesOfItems = items.map((item) =>
    columns.map((column) => column.value(item)),
  )

  const ellipsizedColumnValues = itemValuesOfItems.map((itemValues) =>
    itemValues.map((value, columnIndex) =>
      ellipsize(value, columns[columnIndex].maxWidth ?? 100),
    ),
  )

  const columnWidths: number[] = columns.map((column, columnIndex) => {
    const lengthOfLongestValue = ellipsizedColumnValues.reduce(
      (maxLength, itemValues) => {
        const value = itemValues[columnIndex]
        return Math.max(maxLength, deansitize(value).length)
      },
      0,
    )

    return lengthOfLongestValue
  })

  const rows: Row<T>[] = items.map((item, itemIndex) => {
    const itemValues = itemValuesOfItems[itemIndex]
    const ellipsizedItemValues = ellipsizedColumnValues[itemIndex]
    const paddedItemValues = ellipsizedItemValues.map((value, columnIndex) =>
      value.padEnd(
        columnWidths[columnIndex] + value.length - deansitize(value).length,
      ),
    )

    const displayText = paddedItemValues.join(" ".repeat(columnSpacing))

    return {
      meta: itemValues.join(" ") + metaExtractor?.(item) ?? "",
      name: displayText,
      value: item,
    }
  })

  return rows
}

function filterRows<T>(rows: Row<T>[], input?: string): Row<T>[] {
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

export default createSourceFn
