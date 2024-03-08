import inquirer from "inquirer"

export const chooseAssignToMe = async function (
  isUnassigned: boolean,
): Promise<boolean> {
  const { askAssignToMe } = await inquirer.prompt([
    {
      type: "confirm",
      name: "askAssignToMe",
      message: isUnassigned
        ? "This issue is unassigned. Do you want it to be assigned to you?"
        : "This issue is already assigned. Do you want to assign it to yourself?",
      default: true,
    },
  ])

  return askAssignToMe
}
