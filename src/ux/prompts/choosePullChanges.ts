import { confirm } from "@inquirer/prompts";

export function choosePullChanges() {
  return confirm({
    message:
      "Starting point is not up to date. Do you want latest changes pulled?",
    default: false,
  });
}
