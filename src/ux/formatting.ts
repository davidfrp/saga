const ANSI_ESCAPE_CODE_REGEX = /\u001B\[(\d+)(;\d+)*m/g;

/**
 * Removes ANSI escape codes from a string.
 *
 * @param value The string from which to remove ANSI escape codes.
 * @returns The string with ANSI escape codes removed.
 */
export function deansitize(value: string): string {
  return value.replace(ANSI_ESCAPE_CODE_REGEX, "");
}

/**
 * Truncate a string to a maximum width and append an ellipsis if it exceeds.
 *
 * @param value The string to be truncated.
 * @param maxWidth The maximum allowed width of the string.
 * @param ellipsis The string to append if the value exceeds the maxWidth.
 * @returns The truncated string, appended with an ellipsis if it exceeds the maxWidth.
 */
export function ellipsize(
  value: string,
  maxWidth: number,
  ellipsis = "..."
): string {
  if (deansitize(value).length <= maxWidth) {
    return value;
  }

  const uniquePlaceholderChar = "�";

  if (value.includes(uniquePlaceholderChar)) {
    throw new Error(
      `Value may not contain the unique placeholder character "${uniquePlaceholderChar}"`
    );
  }

  const ansiTemplate = value.replace(deansitize(value), uniquePlaceholderChar);

  const ellipsizedValue = deansitize(value).slice(
    0,
    maxWidth - ellipsis.length
  );

  return (
    ansiTemplate.replace(uniquePlaceholderChar, ellipsizedValue) + ellipsis
  );
}
