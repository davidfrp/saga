import { input } from "@inquirer/prompts";

export function chooseBranch(
  defaultValue: string,
  validate?: (input: string) => boolean | string | Promise<boolean | string>
) {
  return input({
    message: "Enter a branch name",
    default: defaultValue,
    validate,
  });
}
