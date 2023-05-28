import { prompt } from 'inquirer'

export default async function (): Promise<boolean> {
  const { shouldLoginAgain } = await prompt({
    type: 'confirm',
    name: 'shouldLoginAgain',
    message: 'You are already logged in. Do you want to log in anew?',
  })

  return shouldLoginAgain
}
