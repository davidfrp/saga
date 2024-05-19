import { input } from "@inquirer/prompts";

export async function chooseHostname() {
  const jiraHostname = await input({
    message: "Enter your Jira host name (fx. your-domain.atlassian.net)",
    validate: (value: string) =>
      (getUrl(value) && !value.includes("@")) ||
      "You need to enter a valid Jira host name",
  });

  const url = getUrl(jiraHostname);

  if (!url) throw new Error("Invalid Jira host name");

  if (url.protocol !== "https:")
    throw new Error("Jira host name must use HTTPS");

  return url.origin;
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
