import inquirer from "inquirer";

export const chooseLoginAgain = async function (): Promise<boolean> {
  const { shouldLoginAgain } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldLoginAgain",
      message: "You're already logged in. Do you want to re-authenticate?",
      default: false,
    },
  ]);

  return shouldLoginAgain;
};
