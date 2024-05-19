import { input } from "@inquirer/prompts";

export function choosePrTitle(
  defaultValue: string,
  validate?: (input: string) => boolean | string | Promise<boolean | string>
) {
  return input({
    message: "Pull request title",
    default: defaultValue,
    validate,
  });
}
