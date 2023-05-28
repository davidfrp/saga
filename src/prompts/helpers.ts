import { Separator } from 'inquirer'
import * as fuzzysort from 'fuzzysort'

const sanitizeOfAnsiCodes = (value: string): string => {
  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\u001B\[(\d+)(;\d+)*m/g
  return value.replace(ansiPattern, '')
}

const sanitizeValue = (value: string): string =>
  value
    // Replace newlines with punctuation
    .replace(/\n/g, '. ')
    // Remove extra dots
    .replace(/\.{2,}/g, '.')
    // Remove extra spaces
    .replace(/\s{2,}/g, ' ')
    .trim()

/**
 * Extracts a value from an item. Used to extract values from objects.
 * @example (item) => item.author.name
 * @param item The item to extract a value from.
 */
export type ColumnValueExtractor<T> = (item: T) => string

export type SourceFnOptions<T> = {
  /**
   * If specified, only values from these keys or
   * column value extractors will be used.
   */
  columns?: (ColumnValueExtractor<T> | keyof T)[]

  /**
   * Amount of spaces between each value.
   * @default 2
   */
  columnSpacing?: number

  /**
   * If specified, each value will be truncated to this length.
   */
  maxColumnWidth?: number
}

type SourceRow<T> = {
  name: string
  value: T
}

export type SourceFn<T> = (SourceRow<T> | Separator)[]

export const getSourceFn = <T extends Record<string, unknown> | string>(
  items: T[],
  options?: SourceFnOptions<T>,
): ((answersSoFar: T[], input?: string) => SourceFn<T>) => {
  const columnExtractors: ColumnValueExtractor<T>[] | undefined =
    options?.columns?.map((column) =>
      typeof column === 'string'
        ? (item: T) => item[column]?.toString() ?? ''
        : (column as ColumnValueExtractor<T>),
    )

  const extractValues = (item: T): string[] =>
    columnExtractors
      ? columnExtractors.map((extractor) => sanitizeValue(extractor(item)))
      : Object.values(item).map((value) =>
        typeof value === 'string' ? sanitizeValue(value) : '',
      )

  const createRows = (items: T[]): SourceRow<T>[] => {
    const valuesOfItems = items.map((item) => extractValues(item))

    const columnWidths: number[] = []

    for (const values of valuesOfItems) {
      // Loop through each value in the current item
      for (const [index, value] of values.entries()) {
        // If the current column doesn't have a width yet, initialize it to 0
        if (columnWidths[index] === undefined) {
          columnWidths[index] = 0
        }

        const sanitizedValue = sanitizeOfAnsiCodes(value)

        // Update the column width if the current value is longer
        if (sanitizedValue.length > columnWidths[index]) {
          columnWidths[index] = sanitizedValue.length
        }
      }
    }

    const truncatedValues = valuesOfItems.map((values) =>
      values.map((value) => {
        const sanitizedValue = sanitizeOfAnsiCodes(value)

        const maxLength = options?.maxColumnWidth ?? 50

        let truncatedValue = value
        if (sanitizedValue.length > maxLength) {
          truncatedValue = `${value.slice(0, maxLength - 3)}...`
        }

        return value.replace(sanitizedValue, truncatedValue)
      }),
    )

    const paddedValues = truncatedValues.map((values) =>
      values.map((value, index) =>
        value.padEnd(
          columnWidths[index] +
          value.length -
          sanitizeOfAnsiCodes(value).length,
        ),
      ),
    )

    const rows = paddedValues.map((values, index) => ({
      name: values.join(' '.repeat(options?.columnSpacing ?? 2)),
      value: items[index],
    }))

    return rows
  }

  const filterRows = (rows: SourceRow<T>[], input?: string) => {
    input = input?.trim()

    if (!input) return rows

    const results = fuzzysort.go(input, rows.map(({ name }) => name), { limit: 10 })

    if (results.total === 0) return []

    return results.map(({ target }) => rows.find(
      ({ name }) => name === target) as SourceRow<T>
    )
  }

  return (_, input?: string): SourceFn<T> => {
    const rows: SourceRow<T>[] = []

    if (items.some((item) => typeof item !== 'string')) {
      rows.push(...createRows(items))
    } else {
      rows.push(
        ...(items.map((item) => ({
          name: item,
          value: item,
        })) as SourceRow<T>[]),
      )
    }

    const filteredRows = filterRows(rows, input)

    return [...filteredRows, new Separator(' ')]
  }
}
