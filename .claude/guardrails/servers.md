# Servers (since the cutover of 06-10-2026)

SSH key for both: `%USERPROFILE%\.ssh\homeplatform`

- **g5 — production**: `192.168.30.49`, port `8080`, `webheaven.nl` through a cloudflared tunnel (in compose)
  - Repo: `/home/bart/homeplatform-repo` (compose file, scripts and MindBox.ps1 only — no build)
  - Data: `/home/bart/homeplatform/db`, uploads/nas-files on `/mnt/extra-ssd/`
- **G4 — acceptance + management**: `192.168.30.232`, acc port `8081`, bugsink `:8090`, portainer `:9000`,
  cockpit `:9091`, sponsordeck `:8082` (mo14.webheaven.nl). Builds the production images.
  - Repo acc: `/home/bart/homeplatform-repo-acc`, data acc: `/home/bart/homeplatform-acc`
  - The old production repo and data on G4 (`/home/bart/homeplatform-repo`, `/home/bart/homeplatform`) are no longer
    active — clean-up through item 1189. Bugsink still runs from that old repo.
- Host scripts (backup, restore, services-watcher): `scripts/`, per environment (`prod`/`acc`), see `scripts/README.md`.
- Caddy on production crashed or has a config problem: use the skill **caddy-reset**.
