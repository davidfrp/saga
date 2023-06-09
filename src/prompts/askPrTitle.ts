import inquirer from "inquirer"

export default async function (
  defaultValue: string,
  validationFn?: (
    input: string,
  ) => boolean | string | Promise<boolean | string>,
): Promise<string> {
  const { pullRequestTitle } = await inquirer.prompt({
    name: "pullRequestTitle",
    message: "Pull request title",
    default: defaultValue,
    validate: validationFn,
  })

  return pullRequestTitle
}
