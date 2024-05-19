import { checkbox } from "@inquirer/prompts";

export function chooseCheckbox(
  message: string,
  items: string[]
): Promise<string[]> {
  return checkbox({
    message,
    choices: items.map((item) => ({
      name: item,
      value: item,
    })),
  });
}
