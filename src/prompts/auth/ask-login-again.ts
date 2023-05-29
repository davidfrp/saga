import { prompt } from 'inquirer'

export default async function (): Promise<boolean> {
  const { shouldLoginAgain } = await prompt({
    type: 'confirm',
    name: 'shouldLoginAgain',
    message: 'You\'re already logged in. Do you want to re-authenticate?',
    default: false,
  })

  return shouldLoginAgain
}
