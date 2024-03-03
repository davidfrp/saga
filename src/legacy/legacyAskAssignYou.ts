import inquirer from "inquirer"

export default async function (isUnassigned: boolean): Promise<boolean> {
  const { assignUser } = await inquirer.prompt([
    {
      type: "confirm",
      name: "assignUser",
      message: isUnassigned
        ? "This issue is unassigned. Do you want it to be assigned to you?"
        : "This issue is already assigned. Do you want to assign it to yourself?",
      default: true,
    },
  ])

  return assignUser
}
