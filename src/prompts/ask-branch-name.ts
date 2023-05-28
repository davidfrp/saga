import { prompt } from 'inquirer'

export default async function (
  defaultValue?: string,
  validationFn?: (
    input: string,
  ) => boolean | string | Promise<boolean | string>,
): Promise<string> {
  const { branchName } = await prompt({
    name: 'branchName',
    message: 'Enter a branch name',
    default: defaultValue,
    validate: validationFn,
  })

  return branchName as string
}
