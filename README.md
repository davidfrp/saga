Saga, er navnet for et CLI værktøj der sigter efter at aflaste udviklere for de mest hyppige interaktioner man har mellem Jira, GitHub og Git.

Målet er at man som udvikler ikke behøver at skulle forlade sit IDE, når man vil starte eller afslutte arbejde på en opgave.

<!-- ![screen capture of saga issue work]() -->

## Hvad er ideen bag Saga?

Saga bygger på nogle kerneværdier:

- Erstatter hverken Jira, GitHub eller Git. Men automatiserer de mest hyppige flows gennem dem.
- Hellere prioriter flows med enkelte og få kommandoer, fremfor flere eller mange afgrænsede kommandoer.
- Skal kunne tilpasses forskellige teams. Ikke alle teams arbejder ens, og det er OK.
- Være fortrukket langt størstedelen af tiden til at påbegynde opgaver fremfor at bruge Jira, GitHub eller Git hver især.
- Hjælpe til at undgå hyppige fejl i f.eks. navngivning af PRs og forgreninger.

## Installér Saga

<!--
### Via Homebrew (MacOS)

[Installér Homebrew](https://brew.sh/) og kør:

```sh-session
$ brew tap davidfrp/saga && brew install saga
``` -->

### Via npm (MacOS, Linux, Windows)

<!-- Saga er bygget med Node.js og kan installeres via npm. Du skal allerede have node og npm installeret.
Vær opmærksom på, at du via denne installationsmetode benytter dit systems version af Node.js, som kan være en anden version end den, som Saga er bygget med.

Denne metode kan være nyttig, hvis du vil have fin kontrol over CLI-opdateringer, f.eks. i et testet script. -->

```sh-session
$ npm i -g @davidfrp/saga
```

## Konfiguration

Saga opbevarer sine konfigurationer i `~/.config/saga/config.json` (på Mac og Linux) eller `C:\Users\<username>\.config\saga\config.json` (på Windows).

For at konfigurere Saga, skal du enten redigere din config.json direkte, eller bruge kommandoen `saga config` til at opdatere eller læse konfigurationen.

```sh-session
$ saga config list
$ saga config set <key> <value>
$ saga config get <key>
```
