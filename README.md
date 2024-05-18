<div align="center">
<h1>Saga</h1>

A high-level CLI tool for developers juggling between [Jira], [Git], and [GitHub].

![NPM Version][npm_version_badge]

</div>

## **📑 Overview**

Saga is a CLI tool designed to streamline your development workflow by automating the most frequent interactions with Jira, Git, and GitHub.

The goal is to enable developers to initiate and complete tasks without needing to leave their IDE.

Saga serves as a high-level abstraction, replicating the most common actions a developer would typically perform. It's not meant to replace Jira, Git, or GitHub, but rather to complement them. Any low- to medium-level operations should still be performed directly in the respective tools/platforms.

By automating the most tedious aspects of the development process, Saga speeds up your workflow while also minimizes the risk of human error.

## **📦 Installation**

### **Via npm (MacOS, Linux, Windows)**

```sh-session
npm i -g @davidfrp/saga
```

<!-- ### **Via Homebrew (MacOS)**

```sh-session
brew tap davidfrp/saga && brew install saga
``` -->

## **🚀 Getting Started**

To get started, you can run the `saga` command in your terminal. This will guide you through the setup process.

```sh-session
saga
```

## **🔩 Configuration**

Saga stores its configurations in `~/.config/saga/config.json` (on Mac and Linux) or `C:\Users\<username>\.config\saga\config.json` (on Windows).

To configure Saga, you can either edit your `config.json` directly or use the `saga config` command to update or read the configuration.

```sh-session
saga config list
saga config set <key> <value>
saga config get <key>
```

## **Commands**

Here are some of the commands you can use with Saga:

- `saga begin`: Begin work on an issue.
- `saga ready`: Mark an issue as ready for review.

<!-- Badges -->

[npm_version_badge]: https://img.shields.io/npm/v/%40davidfrp%2Fsaga

<!-- Links -->

[jira]: https://www.atlassian.com/software/jira
[git]: https://git-scm.com/
[github]: https://github.com/
[nodejs]: https://nodejs.org/
[homebrew]: https://brew.sh/
