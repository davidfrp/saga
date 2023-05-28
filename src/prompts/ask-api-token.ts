import { prompt } from 'inquirer'

export default async function (): Promise<string> {
  console.log(`
For at kunne se dine opgaver, skal du have et Atlassian API-token.
Hvis du ikke allerede har et, kan du oprette et her:
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
