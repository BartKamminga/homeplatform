# HomePlatform — Claude afspraken

## Deployen

- **Nooit deployen zonder expliciete opdracht van de gebruiker.**
- Deploy verloopt via **GitHub Actions** — push naar de juiste branch:
  - `develop` → acceptatie (poort 8081)
  - `main` → productie (poort 8080)
- Workflow: altijd eerst naar `develop`, testen op acc, dan mergen naar `main`.
- Build-keuze (in de Actions workflow):
  - `fe` — alleen frontend (Vite build + dist upload + Caddy reload)
  - `be` — alleen backend (Docker rebuild)
  - `be_db` — backend + alembic migraties + seed
  - `all` — alles (standaard)

## Roadmap en changelog

De **centrale database (via API op de G4)** is de backlog. Todos en changelog werken samen via de `roadmap_items` tabel:

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

### Taal in code
- **Alle nieuwe code in het Engels**: variabelen, functienamen, class-namen, component-namen, bestandsnamen — vanaf nu Engels, ook in bestaande Nederlandstalige bestanden zodra je erin werkt.
- Comments, commit-messages, roadmap-items en changelog blijven Nederlands (projectbeheer-taal, ongewijzigd).
- Bestaande Nederlandse code wordt niet met terugwerkende kracht in bulk omgezet — dat traject staat los op de roadmap (item 879).

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

## G4 (productieserver)

- IP: `192.168.30.232`, prod poort `8080`, acc poort `8081`
- SSH-key: `%USERPROFILE%\.ssh\homeplatform`
- Pad prod: `/home/bart/homeplatform-repo`
- Pad acc: `/home/bart/homeplatform-acc`

### Caddy reset (bij crash of config-probleem)

```bash
ssh -i %USERPROFILE%\.ssh\homeplatform bart@192.168.30.232
docker compose -f /home/bart/homeplatform-repo/docker-compose.g4.yml down
docker volume rm homeplatform-repo_caddy_config
docker compose -f /home/bart/homeplatform-repo/docker-compose.g4.yml up -d
```
