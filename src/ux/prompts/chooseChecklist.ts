import inquirer from "inquirer";

export const chooseChecklist = async function <
  T extends Record<string, unknown> | string
>(message: string, items: T[]): Promise<T[]> {
  const { item } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "item",
      message,
      choices: items,
    },
  ]);

  return item;
};
