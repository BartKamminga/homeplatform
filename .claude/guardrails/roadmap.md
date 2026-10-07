# Roadmap

The **central database (through the API on production, g5)** is the backlog: table `roadmap_items`.

- Track todos through `/api/roadmap` (POST/PATCH) or `.\roadmap.ps1` — not in conversation notes.
- **At the start of a session**:
  1. Fetch high items with status `idea`: `.\roadmap.ps1 -List -Priority high -Status idea`
  2. Analyse those first — required for `high`, optional for other priorities
  3. Then pick up `pick_up` items first, then `analyzed` items in order of priority
- For the status flow per item, notes and closing with a version: use the skill **roadmap-workflow**.
