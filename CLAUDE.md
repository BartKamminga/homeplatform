# HomePlatform — Claude afspraken

## Deployen

- **Nooit deployen zonder expliciete opdracht van de gebruiker.**
- Gebruik altijd `hpem.ps1` voor deployments, nooit handmatig.
- Build-keuze:
  - `fe` — alleen frontend (Vite build + dist upload + Caddy reload)
  - `be` — alleen backend (Docker rebuild)
  - `be_db` — backend + alembic migraties + seed
  - `all` — alles (standaard)

## Changelog bijwerken vóór elke deploy

Elke deploy die gebruikersgerichte wijzigingen bevat moet vergezeld gaan van:

1. **Een nieuwe alembic-migratie** in `backend/alembic/versions/` die changelog-rijen invoegt voor de betreffende site(s).
   - Geen apostrofs in SQL-strings — gebruik dubbele aanhalingstekens of schrijf ze weg.
   - `down_revision` moet wijzen naar de vorige migratie in de keten.
2. **Een frontend changelog-update** in de relevante site (indien aanwezig).
3. Als het versienummer niet duidelijk is: **eerst vragen** aan de gebruiker.

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
    sites/          Vite MPA: landing, admin, dontforget, nkhockey, mixmusic
  hpem.ps1          Deploy-script (HomePlatformEnvironmentManager)
  docker-compose.nas.yml
```

## NAS

- IP: `192.168.30.193`, poort `8080`
- SSH-key: `%USERPROFILE%\.ssh\homeplatform`
- Pad: `/volume1/homeplatform`
- Synology ACL-problemen: `synoacltool -del <pad>` gevolgd door `chmod 755`.
