# Use case: fiets

Geen git-toegang, geen live meekijken (headless) tenzij anders opgegeven. Er
is geen los CLI-script voor dit domein - werk rechtstreeks met de REST-API.

- Basis: `/api/fiets` (zie `backend/routers/fiets.py`)
- `GET /api/fiets/prognose` — fietsweer-prognose voor de vaste locatie
- `GET /api/fiets/geocode` — locatie opzoeken
- Auth: `Authorization: Bearer hp_<key>` (zie `_shared.md`)

Weinig endpoints - lees `backend/routers/fiets.py` zelf voor de exacte
parameters/response-vorm als je iets specifieks nodig hebt.
