import { prompt } from 'inquirer'

export default async function (): Promise<string> {
  const { email } = await prompt({
    name: 'email',
    message: 'Skriv din arbejdsmail',
    validate: (value: string) =>
      /^\S+@\S+\.\S+$/.test(value) || 'Du skal skrive en gyldig email',
  })

  return email
}
