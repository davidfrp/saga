import inquirer from "inquirer"

export default async function (): Promise<boolean> {
  const { checkOutRemoteBranch } = await inquirer.prompt([
    {
      type: "confirm",
      name: "checkOutRemoteBranch",
      message:
        "A remote branch already exists for this issue. Do you want to check it out instead?",
      default: true,
    },
  ])

  return checkOutRemoteBranch
}
