import { prompt } from 'inquirer'

export default async function (
  defaultValue?: string,
  validationPattern?: RegExp,
): Promise<string> {
  const { pullRequestTitle } = await prompt({
    name: 'pullRequestTitle',
    message: 'Pull request title',
    default: defaultValue,
    validate: (value: string) =>
      (validationPattern?.test(value) ?? true) ||
      'You need to enter a valid pull request title',
  })

  return pullRequestTitle
}
