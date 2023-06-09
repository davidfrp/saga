Saga er et CLI-værktøj der sigter efter at aflaste udviklere ved at automatisere de mest hyppige interaktioner man har mellem Jira, GitHub og Git.

Målet er at man som udvikler ikke behøver at skulle forlade sit IDE, når man vil starte eller afslutte arbejde på en opgave.

<!-- ![screen capture of saga issue start]() -->

## Saga

- Erstatter hverken Jira, GitHub eller Git.
- Prioriterer enkelte og dybdegående kommandoer, fremfor mange og afgrænsede kommandoer.
- Kan tilpasses forskellige teams. Ikke alle teams arbejder ens, og det bør der tages højde for.
- Forebygger indtastningsfejl (fx ved copy-paste af sagers titler) i navning af branches og PRs.

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
npm i -g @davidfrp/saga
```

## Konfiguration

Saga opbevarer sine konfigurationer i `~/.config/saga/config.json` (på Mac og Linux) eller `C:\Users\<username>\.config\saga\config.json` (på Windows).

For at konfigurere Saga, skal du enten redigere din config.json direkte, eller bruge kommandoen `saga config` til at opdatere eller læse konfigurationen.

```sh-session
saga config list
saga config set <key> <value>
saga config get <key>
```

### Hovednøglering

Nogle oplysninger er særligt sårbare og gemmes derfor ikke i konfigurationen. For eksempel gemmes din Atlassian API-nøgle i dit systems hovednøglering (keychain). Dette er med til at sikre at du ikke ved en fejl kommer til at dele særligt sårbare oplysninger med andre.

Hvis du vil fjerne alle dine loginoplysninger kan du logge ud med:

```sh-session
saga auth logout
```
