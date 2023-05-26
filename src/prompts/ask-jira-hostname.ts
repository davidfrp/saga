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
    message: 'Skriv dit Jira hostnavn (fx. dit-domæne.atlassian.net)',
    validate: (value: string) =>
      isUrlValid(value) || 'Du skal skrive et gyldigt Jira hostnavn',
  })

  return jiraHostname
}
