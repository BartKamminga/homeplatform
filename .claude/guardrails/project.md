# Project — HomePlatform

```
homeplatform/
  backend/          FastAPI + SQLModel + SQLite + Alembic
  frontend/
    core/           Shared helpers (api.js, sentry.js, theme.css)
    sites/          Vite MPA: landing, admin, dontforget, tournix, nkhockey, mixmusic
  docker-compose.g4.yml
  docker-compose.acc.yml
```

## Frontend
- Vite MPA — every site has its own `index.html` under `frontend/sites/<site>/`.
- SPA routes (e.g. `/admin/login`) work in dev through the `spaFallback` plugin in `vite.config.js`.
- `<img src>` sends no Authorization header — GET endpoints for uploads have no auth.
- Sentry minimum level: `SENTRY_MIN_LEVEL` in `.env`.

## Local development
- Alembic: `$env:DATABASE_URL = "sqlite:///C:/Projects/homeplatform/db/homeplatform.sqlite"`
- Run migrations from `backend/`:
  `& "C:\Projects\homeplatform\.venv\Scripts\python.exe" -m alembic upgrade head`
- The F5 launch config uses `"python": "${workspaceFolder}/.venv/Scripts/python.exe"`.
- Converting existing Dutch code and UI to English in bulk is a separate track (roadmap item 879).
