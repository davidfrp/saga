import { prompt } from 'inquirer'

export default async function (): Promise<boolean> {
  const { shouldLoginAgain } = await prompt({
    type: 'confirm',
    name: 'shouldLoginAgain',
    message: 'Du er allerede logget ind. Vil du overskrive og logge ind på ny?',
  })

  return shouldLoginAgain
}
