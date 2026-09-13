# Use case: hockey-inside

Geen git-toegang, geen live meekijken (headless) tenzij anders opgegeven. Er
is geen los CLI-script voor dit domein - werk rechtstreeks met de REST-API.

Groot domein (19 routerbestanden onder `backend/routers/hockey_*.py`), alle
onder prefix `/api/hockey`, gesplitst per tag - begin bij de tag die bij je
taak past i.p.v. alles te doorzoeken:

- `hockey-public` (`hockey_public.py`) — publieke data (Poulebord-feed)
- `hockey-query` (`hockey_query.py`) — scores/standen opvragen
- `hockey-clubs` (`hockey_clubs.py`, `hockey_team_detail.py`) — clubs/teams
- `hockey-publications` (`hockey_publication.py`) — publicatie-configuratie
  (bron voor Poulebord, zie ook use case `poulebord`)
- `hockey-vanger` (`hockey_vanger_*.py`, 9 bestanden) — scan-queue, smartscan,
  heartbeat, gap-analysis, calendar; dit is de scraper/scan-kant, niet de
  weergave-kant
- `hockey-scenario` / `hockey-capture` / `hockey-plugin-errors` — resp.
  wat-als-scenario's, live-wedstrijd-capture, plugin-foutmeldingen

Auth: `Authorization: Bearer hp_<key>` (zie `_shared.md`). Lees het specifieke
routerbestand voor exacte endpoints/parameters - deze lijst is een wegwijzer,
geen volledige referentie (rot anders snel).
