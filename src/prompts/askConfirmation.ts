import inquirer from "inquirer"

export default async function (): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: "Yes, I want this",
      default: false,
    },
  ])

  return confirmed
}
