import { prompt } from 'inquirer'

export default async function (
  defaultValue?: string,
  validationPattern?: RegExp,
): Promise<string> {
  const { pullRequestTitle } = await prompt({
    name: 'pullRequestTitle',
    message: 'Hvad skal være titlen for din pull request?',
    default: defaultValue,
    validate: (value: string) =>
      (validationPattern?.test(value) ?? true) ||
      'Du skal skrive en gyldig pull request titel',
  })

  return pullRequestTitle
}
