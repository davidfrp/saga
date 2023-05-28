import { prompt } from 'inquirer'
import { edit } from 'external-editor'

export default async function (defaultValue: string): Promise<string> {
  const { useDefaultBody } = await prompt({
    type: 'confirm',
    name: 'useDefaultBody',
    message: 'Want to use the default body?',
  })

  let body = defaultValue
  if (!useDefaultBody) {
    body = edit(body, { postfix: '.txt' })
  }

  return body
}
