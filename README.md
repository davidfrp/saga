oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g saga
$ saga COMMAND
running command...
$ saga (--version)
saga/0.0.0 darwin-arm64 node-v20.11.0
$ saga --help [COMMAND]
USAGE
  $ saga COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`saga hello PERSON`](#saga-hello-person)
* [`saga hello world`](#saga-hello-world)
* [`saga help [COMMAND]`](#saga-help-command)
* [`saga plugins`](#saga-plugins)
* [`saga plugins:install PLUGIN...`](#saga-pluginsinstall-plugin)
* [`saga plugins:inspect PLUGIN...`](#saga-pluginsinspect-plugin)
* [`saga plugins:install PLUGIN...`](#saga-pluginsinstall-plugin-1)
* [`saga plugins:link PLUGIN`](#saga-pluginslink-plugin)
* [`saga plugins:uninstall PLUGIN...`](#saga-pluginsuninstall-plugin)
* [`saga plugins reset`](#saga-plugins-reset)
* [`saga plugins:uninstall PLUGIN...`](#saga-pluginsuninstall-plugin-1)
* [`saga plugins:uninstall PLUGIN...`](#saga-pluginsuninstall-plugin-2)
* [`saga plugins update`](#saga-plugins-update)

## `saga hello PERSON`

Say hello

```
USAGE
  $ saga hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/davidfrp/saga/blob/v0.0.0/src/commands/hello/index.ts)_

## `saga hello world`

Say hello world

```
USAGE
  $ saga hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ saga hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/davidfrp/saga/blob/v0.0.0/src/commands/hello/world.ts)_

## `saga help [COMMAND]`

Display help for saga.

```
USAGE
  $ saga help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for saga.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.17/src/commands/help.ts)_

## `saga plugins`

List installed plugins.

```
USAGE
  $ saga plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ saga plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/index.ts)_

## `saga plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ saga plugins add plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ saga plugins add

EXAMPLES
  $ saga plugins add myplugin 

  $ saga plugins add https://github.com/someuser/someplugin

  $ saga plugins add someuser/someplugin
```

## `saga plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ saga plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ saga plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/inspect.ts)_

## `saga plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ saga plugins install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ saga plugins add

EXAMPLES
  $ saga plugins install myplugin 

  $ saga plugins install https://github.com/someuser/someplugin

  $ saga plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/install.ts)_

## `saga plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ saga plugins link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ saga plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/link.ts)_

## `saga plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ saga plugins remove plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ saga plugins unlink
  $ saga plugins remove

EXAMPLES
  $ saga plugins remove myplugin
```

## `saga plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ saga plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/reset.ts)_

## `saga plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ saga plugins uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ saga plugins unlink
  $ saga plugins remove

EXAMPLES
  $ saga plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/uninstall.ts)_

## `saga plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ saga plugins unlink plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ saga plugins unlink
  $ saga plugins remove

EXAMPLES
  $ saga plugins unlink myplugin
```

## `saga plugins update`

Update installed plugins.

```
USAGE
  $ saga plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.3.2/src/commands/plugins/update.ts)_
<!-- commandsstop -->
