# HomePlatform sessie-onboarding

Je draait in een dev-session-container (agent-control). Lees dit voor je iets
anders doet - het scheelt je zelf moeten uitzoeken.

## Omgevingen

- **prod** — poort 8080, `https://<extern-domein>` of `http://192.168.30.232:8080`
- **acc** — poort 8081, acceptatie, aparte database
- **local** — alleen relevant als je zelf lokaal draait, niet vanuit deze container

Elke omgeving heeft een EIGEN database - ID's van acc bestaan niet op prod en
andersom. Deze sessie is opgezet voor omgeving: zie de env var `SESSION_ENV`.

## Auth

De API gebruikt `Authorization: Bearer hp_<key>` (API-key, geen JWT-login
nodig). Als er config voor jouw omgeving beschikbaar is gemaakt, staat die
read-only onder `/root/.session-config/` (bv. `.mindbox.config.<env>.ps1` /
`.roadmap.config.ps1`) - gebruik die, vraag niet aan de gebruiker om 'm zelf
te draaien.

## Scripts

- `roadmap.ps1` — roadmap-items beheren (todo's, changelog). Gebruik
  `.\roadmap.ps1 -Setup` alleen als er nog geen config staat.
- `MindBox.ps1` — MindBox-cases/items beheren. `-Env <prod|acc|local>` kiest
  de omgeving.

Beide scripts praten uitsluitend met de backend-API - geen lokale database.

## Wat NIET te doen

- Geen git-acties als deze sessie geen git-toegang heeft (zie je eigen
  onboarding-document hieronder voor je specifieke taak).
- Geen bestanden buiten de API om wijzigen als je alleen read-only
  bestandstoegang hebt gekregen (bv. `/mnt/mindbox-files`).
