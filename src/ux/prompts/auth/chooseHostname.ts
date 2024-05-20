import { input } from "@inquirer/prompts";

export async function chooseHostname() {
  const jiraHostname = await input({
    message: "Enter your Jira host name (fx. your-domain.atlassian.net)",
    validate: (value: string) => {
      if (value.startsWith("http://")) return "Jira host name must use HTTPS";

      if (!getUrl(value) || value.includes("@"))
        return "You need to enter a valid Jira host name";

      return true;
    },
  });

  const url = getUrl(jiraHostname);

  if (!url) throw new Error("Invalid Jira host name");

  return url.hostname;
}

function getUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch (error) {
    if (!value.startsWith("https")) {
      return getUrl(`https://${value}`);
    }

    return null;
  }
}
