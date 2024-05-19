import { confirm } from "@inquirer/prompts";

export function chooseLoginAgain() {
  return confirm({
    message: "You're already logged in. Do you want to re-authenticate?",
    default: false,
  });
}
