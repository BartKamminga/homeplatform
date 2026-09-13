# Use case: poulebord

Geen git-toegang, geen live meekijken (headless) tenzij anders opgegeven. Er
is geen los CLI-script voor dit domein - werk rechtstreeks met de REST-API.

- Basis: `/api/tournix` (zie `backend/routers/poulebord.py` - historische
  naam "tournix" in de URL, gebruikersnaam is Poulebord)
- `public/boards`, `public/boards/{code}` — poulebord-configuratie (aanmaken/
  ophalen)
- `public/tournaments/{tid}/phases`, `public/phases/{pid}/pool-matches`,
  `public/phases/{pid}/standings` — wedstrijden/stand per fase
- `public/search` — zoeken naar teams/competities
- Onderliggende brondata (competities/publicaties) komt uit hockey-inside
  (`/api/hockey/publications`, zie use case `hockey_inside`) - wijzigingen
  daar zijn zichtbaar in Poulebord, niet andersom.
- Auth: publieke `public/*`-endpoints hebben meestal geen key nodig; voor
  beheer-acties `Authorization: Bearer hp_<key>` (zie `_shared.md`).
