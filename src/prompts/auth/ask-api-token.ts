import { prompt } from 'inquirer'

export default async function (): Promise<string> {
  console.log(`
To be able to see your issues, you need an Atlassian API-token.
If you don't already have one, you can create one here:
https://id.atlassian.com/manage-profile/security/api-tokens
`)

  const { token } = await prompt({
    type: 'password',
    mask: '*',
    name: 'token',
    message: 'Insert your Atlassian API-token',
  })

  return token
}
