import inquirer from "inquirer"

export default async function (): Promise<boolean> {
  const { assignUser } = await inquirer.prompt([
    {
      type: "confirm",
      name: "assignUser",
      message:
        "This issue is unassigned. Do you want it to be assigned to you?",
      default: true,
    },
  ])

  return assignUser
}
