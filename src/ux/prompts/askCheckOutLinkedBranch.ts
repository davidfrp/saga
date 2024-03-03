import inquirer from "inquirer"

export default async function (): Promise<boolean> {
  const { shouldCheckOutLinkedBranch } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldCheckOutLinkedBranch",
      message:
        "Another branch is already linked to this issue. Do you want to check it out instead?",
      default: true,
    },
  ])

  return shouldCheckOutLinkedBranch
}
