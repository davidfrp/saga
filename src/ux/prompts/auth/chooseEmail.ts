import inquirer from "inquirer"

export const chooseEmail = async function (): Promise<string> {
  const { email } = await inquirer.prompt({
    name: "email",
    message: "Enter your email",
    validate: (value: string) =>
      /^\S+@\S+\.\S+$/.test(value) || "You need to enter a valid email",
  })

  return email
}
