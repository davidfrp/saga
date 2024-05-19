import { password } from "@inquirer/prompts";

export function chooseToken() {
  console.log(`
To be able to see your issues, you need an Atlassian API-token.
If you don't already have one, you can create one here:
https://id.atlassian.com/manage-profile/security/api-tokens
`);

  return password({
    message: "Insert your Atlassian API-token",
    mask: "*",
  });
}
