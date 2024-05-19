import { input } from "@inquirer/prompts";

export function chooseEmail() {
  return input({
    message: "Enter your email",
    validate: (value: string) =>
      /^\S+@\S+\.\S+$/.test(value) || "You need to enter a valid email",
  });
}
