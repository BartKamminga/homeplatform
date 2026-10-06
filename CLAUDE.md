# HomePlatform — Claude afspraken

## Deployen

- **Nooit deployen zonder expliciete opdracht van de gebruiker.**
- Deploy verloopt via **GitHub Actions** — push naar de juiste branch:
  - `develop` → acceptatie op G4 (poort 8081), lokaal gebouwd
  - `main` → productie op g5 (poort 8080): G4 bouwt images → GHCR → g5 pullt
- Workflow: altijd eerst naar `develop`, testen op acc, dan mergen naar `main`.
- Prod-deploy volgorde: images pullen → db-snapshot (`db/backups/pre-deploy-*`) → backend/ghost/agent_worker
  → migraties + seed → pas dan web (Caddy + frontend in image `homeplatform-web`).
- Compose-commando's op prod vereisen `IMAGE_TAG` (geen `:latest`-fallback):
  `export IMAGE_TAG=$(git rev-parse --short=7 HEAD)`.

## Roadmap en changelog

De **centrale database (via API op prod, g5)** is de backlog. Todos en changelog werken samen via de `roadmap_items` tabel:

- **Todos bijhouden**: gebruik `/api/roadmap` (POST/PATCH) of `.\roadmap.ps1` — niet in conversatienotities.
- **Aan het begin van een sessie**:
  1. Haal high-items op met status `idea`: `.\roadmap.ps1 -List -Priority high -Status idea`
  2. Analyseer die items eerst (zie stap 1 hieronder) — verplicht voor `high`, optioneel voor andere prioriteiten
  3. Daarna: pak `pick_up`-items op als eerste, dan `analyzed`-items in volgorde van prioriteit
- **Werkwijze per item**:
  1. Analyseer → status `analyzed`: vul `impact` (op gebruiker), `risk`, `scope` in, en sla de redenering op in het `notes`-veld
     - **High-items: altijd analyseren vóór je begint**
  2. (Optioneel) Gebruiker markeert item als `pick_up` — geeft expliciete prioriteit voor volgende sessie
  3. Begin → status `in_progress`
  4. Tijdens werken → notities bijhouden in het `notes`-veld (gaan later naar changelog)
  5. Code klaar, nog niet gedeployed → status `ready`
  6. Gedeployed op acceptatie, nog niet op prod → status `on_acc`
  7. Deploy naar prod gestart → status `deploying`
  8. Na succesvolle deploy naar prod → status `done` + versienummer → changelog-entry automatisch aangemaakt
- **Versienummer onduidelijk**: eerst vragen aan de gebruiker.
- **Meerdere items afsluiten**: gebruik `.\roadmap.ps1 -Close -Ids "534,535,536" -Version v3.33` — één commando voor alle items in dezelfde deploy.
- Handmatige alembic-migraties voor changelog zijn niet meer nodig bij items die via de roadmap lopen.
- Voor infrastructurele DB-wijzigingen (nieuwe tabellen, kolommen) blijft de alembic-migratie vereist:
  - Geen apostrofs in SQL-strings — gebruik dubbele aanhalingstekens of schrijf ze weg.
  - `down_revision` moet wijzen naar de vorige migratie in de keten.

## Versiestrategie

Gebruik **MAJOR.MINOR.PATCH** semantisch versionnummer:

| Level | Wanneer | Voorbeeld |
|---|---|---|
| **MAJOR** | Nieuwe site live, infra-migratie, architectuurwijziging | Hockey Inside launch → `v4.0` |
| **MINOR** | Significante feature in één of meer sites, admin uitbreiding | Poulebord pins → `v4.1` |
| **PATCH** | Bugfix, kleine tweak, deploy-fix | Caddy config fix → `v4.0.1` |

Bij `.\roadmap.ps1 -Close -Ids "..." -Version v4.1`:
1. Items worden gesloten + changelog aangemaakt
2. Git tag `v4.1` wordt aangemaakt en gepusht
3. GitHub Release `v4.1` wordt aangemaakt met release notes per site

## Technische afspraken

### Taal
- **Gesprekken met Claude**: Nederlands.
- **Code**: Engels — variabelen, functienamen, class-namen, component-namen, bestandsnamen — vanaf nu Engels, ook in bestaande Nederlandstalige bestanden zodra je erin werkt.
- **UI van de apps (labels, knoppen, teksten die eindgebruikers zien)**: bij voorkeur ook Engels, zelfde regime als code — nieuwe UI-teksten in het Engels, bestaande Nederlandse UI-teksten omzetten zodra je erin werkt.
- Comments, commit-messages, roadmap-items en changelog blijven Nederlands (projectbeheer-taal, ongewijzigd).
- Bestaande Nederlandse code/UI wordt niet met terugwerkende kracht in bulk omgezet — dat traject staat los op de roadmap (item 879).

### PowerShell
- Shell is PowerShell 5.1 — geen `&&`, gebruik `;` of aparte statements.
- Backtick-quoting in `cmd /c`-strings veroorzaakt parser-fouten — gebruik string-concatenatie.

### Alembic (lokaal)
- Altijd absolute DATABASE_URL meegeven:
  `$env:DATABASE_URL = "sqlite:///C:/Projects/homeplatform/db/homeplatform.sqlite"`
- Als de DB geen `alembic_version`-tabel heeft: eerst stampen op de vorige revisie, dan upgraden.
- Lokale migraties uitvoeren vanuit `backend/`:
  `& "C:\Projects\homeplatform\.venv\Scripts\python.exe" -m alembic upgrade head`

### Venv
- Gebruik altijd `python -m pip install` (niet `pip.exe`) om zeker te zijn van de juiste venv.
- F5 launch config gebruikt `"python": "${workspaceFolder}/.venv/Scripts/python.exe"`.

### Frontend
- Vite MPA — elke site heeft eigen `index.html` onder `frontend/sites/<site>/`.
- SPA-routes (bijv. `/admin/login`) werken in dev via de `spaFallback`-plugin in `vite.config.js`.
- `<img src>` stuurt geen Authorization-header — GET-endpoints voor uploads zijn zonder auth.
- **Bestandsgrens**: bestanden >300 regels altijd aankaarten — dit is een signaal dat opsplitsing nodig is.

### Sentry / GlitchTip
- `await Sentry.flush(1500)` aanroepen vóór `window.location.href`-redirects, anders gaan events verloren.
- Minimumniveau instelbaar via `SENTRY_MIN_LEVEL` in `.env`.

## Projectstructuur (kort)

```
homeplatform/
  backend/          FastAPI + SQLModel + SQLite + Alembic
  frontend/
    core/           Gedeelde helpers (api.js, sentry.js, theme.css)
    sites/          Vite MPA: landing, admin, dontforget, tournix, nkhockey, mixmusic
  docker-compose.g4.yml
  docker-compose.acc.yml
```

## Servers (sinds cutover 06-10-2026)

SSH-key voor beide: `%USERPROFILE%\.ssh\homeplatform`

- **g5 — productie**: `192.168.30.49`, poort `8080`, `webheaven.nl` via cloudflared-tunnel (in compose)
  - Repo: `/home/bart/homeplatform-repo` (alleen compose-file, scripts, MindBox.ps1 — geen build)
  - Data: `/home/bart/homeplatform/db`, uploads/nas-files op `/mnt/extra-ssd/`
- **G4 — acceptatie + beheer**: `192.168.30.232`, acc poort `8081`, bugsink `:8090`, portainer `:9000`,
  cockpit `:9091`, sponsordeck `:8082` (mo14.webheaven.nl). Bouwt de prod-images.
  - Repo acc: `/home/bart/homeplatform-repo-acc`, data acc: `/home/bart/homeplatform-acc`
  - Oude prod-repo/data op G4 (`/home/bart/homeplatform-repo`, `/home/bart/homeplatform`) is niet meer
    actief — opruimen via item 1189. Bugsink draait nog vanuit die oude repo.
- Host-scripts (backup, restore, services-watcher): `scripts/`, per omgeving (`prod`/`acc`), zie `scripts/README.md`.

### Caddy reset op prod (bij crash of config-probleem)

```bash
ssh -i %USERPROFILE%\.ssh\homeplatform bart@192.168.30.49
cd /home/bart/homeplatform-repo && export IMAGE_TAG=$(git rev-parse --short=7 HEAD)
docker compose -f docker-compose.g4.yml rm -sf caddy
docker volume rm homeplatform-repo_caddy_config
docker compose -f docker-compose.g4.yml up -d --no-deps caddy
```
