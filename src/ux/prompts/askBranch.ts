import inquirer from "inquirer"

export default async function (
  defaultValue: string,
  validationFn?: (
    input: string,
  ) => boolean | string | Promise<boolean | string>,
): Promise<string> {
  const { branchName } = await inquirer.prompt([
    {
      type: "input",
      name: "branchName",
      message: "Enter a branch name",
      default: defaultValue,
      validate: validationFn,
    },
  ])

  return branchName
}
