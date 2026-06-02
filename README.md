# Homeplatform

Thuisplatform voor het ontwikkelen, testen en publiceren van webapplicaties op een Synology NAS.

---

## Lokaal opstarten (VS Code)

### 1. Repository clonen

```bash
git clone <gitea-url>/homeplatform.git
cd homeplatform
```

### 2. VS Code workspace openen

```bash
code homeplatform.code-workspace
```

VS Code vraagt automatisch om de aanbevolen extensies te installeren — bevestig dit.

### 3. Python omgeving aanmaken

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate        # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Environment variabelen instellen

```bash
cp .env.example .env
# .env hoeft niet aangepast te worden voor lokaal development
```

### 5. Database aanmaken

```bash
cd backend
mkdir -p ../db
alembic upgrade head
```

Controle — je ziet nu:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, core init
```

### 6. Backend starten

**Optie A — direct in VS Code (met debugger)**

Druk op `F5` en kies `FastAPI (uvicorn)`.

**Optie B — terminal**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Optie C — Docker**

```bash
docker compose -f docker-compose.dev.yml up
```

### 7. Controleren

Open in je browser:

| URL | Wat je ziet |
|---|---|
| http://localhost:8000 | `{"message": "Homeplatform API"}` |
| http://localhost:8000/api/health | `{"status": "ok"}` |
| http://localhost:8000/api/version | Core versie + DB revisie |
| http://localhost:8000/api/docs | Swagger UI (alleen in development) |

---

## Projectstructuur

```
homeplatform/
├── backend/
│   ├── core/           ← gedeelde platform modules
│   ├── routers/        ← API endpoints
│   ├── models/         ← database modellen
│   ├── alembic/        ← database migraties
│   ├── main.py         ← FastAPI entrypoint
│   └── requirements.txt
├── frontend/
│   ├── core/           ← gedeelde UI (theme, layout, auth)
│   ├── components/     ← herbruikbare componenten
│   └── sites/          ← één map per sub-site
├── db/                 ← SQLite database (lokaal)
├── .vscode/            ← VS Code configuratie
├── docker-compose.yml          ← productie (NAS)
├── docker-compose.dev.yml      ← development (laptop)
└── homeplatform.code-workspace
```

---

## Volgende stap — frontend skeleton

```bash
cd frontend
npm create vite@latest core -- --template react
npm install
npm run dev
```

Vite dev server draait op http://localhost:5173

---

## Nieuwe site toevoegen

Zie `docs/homeplatform.md` — sectie 11.

---

## Nuttige commando's

```bash
# Nieuwe migratie aanmaken
cd backend && alembic revision -m "beschrijving"

# Database status bekijken
cd backend && alembic current

# Terug naar vorige migratie
cd backend && alembic downgrade -1

# Alle migraties bekijken
cd backend && alembic history
```
