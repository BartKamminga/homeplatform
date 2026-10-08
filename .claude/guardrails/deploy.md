# Deploy — HomePlatform

- Deploys run through **GitHub Actions** — push to the right branch:
  - `develop` → acceptance on G4 (port 8081), built locally
  - `main` → production on g5 (port 8080): G4 builds the images → GHCR → g5 pulls
- Production deploy order: pull images → db snapshot (`db/backups/pre-deploy-*`) → backend/ghost/agent_worker
  → migrations + seed → only then web (Caddy + frontend in image `homeplatform-web`).
- Compose commands on production require `IMAGE_TAG` (no `:latest` fallback):
  `export IMAGE_TAG=$(git rev-parse --short=7 HEAD)`.
