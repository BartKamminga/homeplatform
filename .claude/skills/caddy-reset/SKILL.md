---
name: caddy-reset
description: Reset Caddy on the HomePlatform production server (g5) after a crash or config problem. Only on an explicit request from the user.
---
# Caddy reset on production

Only run this when the user asks for it.

```bash
ssh -i %USERPROFILE%\.ssh\homeplatform bart@192.168.30.49
cd /home/bart/homeplatform-repo && export IMAGE_TAG=$(git rev-parse --short=7 HEAD)
docker compose -f docker-compose.g4.yml rm -sf caddy
docker volume rm homeplatform-repo_caddy_config
docker compose -f docker-compose.g4.yml up -d --no-deps caddy
```
