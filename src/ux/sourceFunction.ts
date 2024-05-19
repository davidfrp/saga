import fuzzysort from "fuzzysort";
import {
  Separator,
  ChoiceOrSeparatorArray,
} from "inquirer-autocomplete-standalone";
import { deansitize, ellipsize } from "./formatting.js";

type Choice<Value> = Extract<
  ChoiceOrSeparatorArray<Value>[number],
  { value: Value }
>;

type SearchableChoice<Value> = Choice<Value> & {
  raw: string;
};

export type ColumnValueExtractor<Value> = (item: Value) => string;

export type Column<Value> = {
  /**
   * Value to display in the column.
   * @example (item) => item.author.firstName
   */
  value: ColumnValueExtractor<Value>;

  /**
   * Max width of the column.
   * @default Infinity
   */
  maxWidth?: number;
};

export interface CreateSourceFunctionOptionsBase<Value> {
  /**
   * If specified, only values from these keys or
   * column value extractors will be used.
   */
  columns?: Column<Value>[];

  /**
   * Amount of spaces between each value.
   * @default 2
   */
  columnSpacing?: number;

  /**
   * Returns a string that describes the item. The description
   * will be displayed below the list of choices.
   * @example (item) => item.author.bio
   */
  describe?(item: Value): string;
}

export interface CreateSourceFunctionOptionsWithoutNoSelection<Value>
  extends CreateSourceFunctionOptionsBase<Value> {
  /**
   * If defined, the user will be able to select no value.
   */
  noSelectionText?: undefined;
}

export interface CreateSourceFunctionOptionsWithNoSelection<Value>
  extends CreateSourceFunctionOptionsBase<Value> {
  /**
   * If defined, the user will be able to select no value.
   */
  noSelectionText: string;
}

export type CreateSourceFunctionOptions<Value> =
  | CreateSourceFunctionOptionsWithoutNoSelection<Value>
  | CreateSourceFunctionOptionsWithNoSelection<Value>;

export function createSourceFunction<Value>(
  items: Value[],
  options?: CreateSourceFunctionOptionsWithoutNoSelection<Value>
): (input?: string | undefined) => Promise<ChoiceOrSeparatorArray<Value>>;

export function createSourceFunction<Value>(
  items: Value[],
  options?: CreateSourceFunctionOptionsWithNoSelection<Value>
): (
  input?: string | undefined
) => Promise<ChoiceOrSeparatorArray<Value | null>>;

export function createSourceFunction<Value>(
  items: Value[],
  options: CreateSourceFunctionOptions<Value> = {}
) {
  async function sourceFunction(
    input?: string
  ): Promise<ChoiceOrSeparatorArray<Value | null>> {
    const choices = choicesFrom(items, options);

    const searchResultChoices = searchChoices(choices, input);

    const choicesWithSeparator = [...searchResultChoices, new Separator()];

    const { noSelectionText } = options;

    if (!noSelectionText || (input && searchResultChoices.length))
      return choicesWithSeparator;

    const noSelectionChoice: Choice<null> = {
      name: noSelectionText,
      value: null,
    };

    return [noSelectionChoice, ...choicesWithSeparator];
  }

  return sourceFunction;
}

function choicesFrom<Value>(
  items: Value[],
  {
    columns = [],
    columnSpacing = 2,
    describe,
  }: CreateSourceFunctionOptions<Value>
) {
  const values: string[][] = items.map((item) =>
    columns.map((column) => column.value(item))
  );

  const ellipsizedValues = values.map((value) =>
    value.map((column, index) =>
      ellipsize(column, columns[index].maxWidth ?? Infinity)
    )
  );

  const columnWidths = columns.map((_, index) =>
    ellipsizedValues.reduce(
      (maxLength, value) =>
        Math.max(maxLength, deansitize(value[index]).length),
      0
    )
  );

  const choices = items.map((item, index): SearchableChoice<Value> => {
    const ellipsizedValue = ellipsizedValues[index];
    const paddedValue = ellipsizedValue.map((column, columnIndex) =>
      column.padEnd(
        columnWidths[columnIndex] + column.length - deansitize(column).length
      )
    );

    const name = paddedValue.join(" ".repeat(columnSpacing));
    const description = describe?.(item);
    const raw = values[index].map(deansitize).join(" ");

    return {
      value: item,
      name,
      description,
      raw,
    };
  });

  return choices;
}

function searchChoices<Value>(
  choices: SearchableChoice<Value>[],
  input?: string
) {
  if (!input) return choices;

  const targets = choices.map((choice) => choice.raw);

  const results = fuzzysort.go(input, targets, { limit: 10 });

  const filteredChoices = results
    .map((result) => choices.find((choice) => choice.raw === result.target))
    .filter((choice): choice is SearchableChoice<Value> => Boolean(choice));

  return filteredChoices;
}
