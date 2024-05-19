import { confirm } from "@inquirer/prompts";

export function chooseAssignToMe(isUnassigned: boolean) {
  return confirm({
    message: isUnassigned
      ? "This issue is unassigned. Do you want it to be assigned to you?"
      : "This issue is already assigned. Do you want to assign it to yourself?",
    default: true,
  });
}
