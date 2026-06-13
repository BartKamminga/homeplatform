# HomePlatform — Claude afspraken

## Deployen

- **Nooit deployen zonder expliciete opdracht van de gebruiker.**
- Gebruik altijd `hpem.ps1` voor deployments, nooit handmatig.
- Build-keuze:
  - `fe` — alleen frontend (Vite build + dist upload + Caddy reload)
  - `be` — alleen backend (Docker rebuild)
  - `be_db` — backend + alembic migraties + seed
  - `all` — alles (standaard)

## Roadmap en changelog

De **NAS-database is de centrale backlog**. Todos en changelog werken samen via de `roadmap_items` tabel:

- **Todos bijhouden**: gebruik `/api/roadmap` (POST/PATCH) of `.\roadmap.ps1` — niet in conversatienotities.
- **Aan het begin van een sessie**:
  1. Haal hoog-items op met status `idee`: `.\roadmap.ps1 -List -Priority hoog -Status idee`
  2. Analyseer die items eerst (zie stap 1 hieronder) — verplicht voor `hoog`, optioneel voor andere prioriteiten
  3. Daarna: pak `geanalyseerd`-items op in volgorde van prioriteit
- **Werkwijze per item**:
  1. Analyseer → status `geanalyseerd`: vul `impact` (op gebruiker), `risico`, `scope` in, en sla de redenering op in het `notes`-veld
     - **Hoog-items: altijd analyseren vóór je begint**
  2. Begin → status `in_progress`
  3. Tijdens werken → notities bijhouden in het `notes`-veld (gaan later naar changelog)
  4. Code klaar, nog niet gedeployed → status `gereed`
  5. Deploy gestart → status `deploying`
  6. Na succesvolle deploy naar NAS → status `klaar` + versienummer → changelog-entry automatisch aangemaakt
- **Versienummer onduidelijk**: eerst vragen aan de gebruiker.
- Handmatige alembic-migraties voor changelog zijn niet meer nodig bij items die via de roadmap lopen.
- Voor infrastructurele DB-wijzigingen (nieuwe tabellen, kolommen) blijft de alembic-migratie vereist:
  - Geen apostrofs in SQL-strings — gebruik dubbele aanhalingstekens of schrijf ze weg.
  - `down_revision` moet wijzen naar de vorige migratie in de keten.

## Technische afspraken

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
  hpem.ps1          Deploy-script (HomePlatformEnvironmentManager)
  docker-compose.nas.yml
```

## NAS

- IP: `192.168.30.193`, poort `8080`
- SSH-key: `%USERPROFILE%\.ssh\homeplatform`
- Pad: `/volume1/homeplatform`
- Synology ACL-problemen: `synoacltool -del <pad>` gevolgd door `chmod 755`.
