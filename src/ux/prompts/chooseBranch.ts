import inquirer from "inquirer";

export const chooseBranch = async function (
  defaultValue: string,
  validationFn?: (input: string) => boolean | string | Promise<boolean | string>
): Promise<string> {
  const { branchName } = await inquirer.prompt([
    {
      type: "input",
      name: "branchName",
      message: "Enter a branch name",
      default: defaultValue ? defaultValue : undefined,
      validate: validationFn,
    },
  ]);

  return branchName;
};
