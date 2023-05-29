import { prompt } from 'inquirer'

function isUrlValid(value: string): boolean {
  try {
    return Boolean(new URL(value))
  } catch {
    if (!value.startsWith('https')) {
      return isUrlValid(`https://${value}`)
    }

    return false
  }
}

export default async function (): Promise<string> {
  const { jiraHostname } = await prompt({
    name: 'jiraHostname',
    message: 'Enter your Jira host name (fx. your-domain.atlassian.net)',
    validate: (value: string) =>
      isUrlValid(value) || 'You need to enter a valid Jira host name',
  })

  return jiraHostname
}
