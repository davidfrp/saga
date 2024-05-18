import inquirer from "inquirer";

export const choosePrTitle = async function (
  defaultValue: string,
  validationFn?: (input: string) => boolean | string | Promise<boolean | string>
): Promise<string> {
  const { pullRequestTitle } = await inquirer.prompt({
    name: "pullRequestTitle",
    message: "Pull request title",
    default: defaultValue ? defaultValue : undefined,
    validate: validationFn,
  });

  return pullRequestTitle;
};
