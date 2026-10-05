# Cutover G4 → g5 (prod) — stappenplan

Opgesteld 05-10-2026, uit te voeren 06-10-2026. Doel: `webheaven.nl` laten bedienen door g5
(192.168.30.49) in plaats van G4 (192.168.30.232). G4 blijft daarna acc + beheer-/dev-host.

Geschatte duur: 60–90 min, waarvan **~5–10 min downtime** (fase 2 t/m 4).

SSH: `ssh -i ~/.ssh/homeplatform bart@192.168.30.232` (G4) en `... bart@192.168.30.49` (g5).

## Uitgangssituatie (gecontroleerd 05-10)

| | G4 (live) | g5 |
|---|---|---|
| Verkeer webheaven.nl | ✅ via `homeplatform_cloudflared` (token-tunnel) | ❌ alleen testtunnel `g5.webheaven.nl` |
| Backend | oud image (26-09), container sinds 30-09 | `5bdfac9` (v5.8), correct |
| DB | live, alembic `b4d6f8a0c2e4` | eigen kopie; staging-db elke 15 min ververst |
| Frontend | nieuwste (pipeline bouwt op G4) | nieuwste |
| Crons | backup, backup-files, restore, services-watcher, sync-to-g5 | backup + backup-files — **tijdelijk uit** via `db/cron_disabled` |

Tunnel-ingress (Cloudflare, remote-managed, token in `.env` als `CLOUDFLARE_TUNNEL_TOKEN`):
- `webheaven.nl` → `http://caddy:80` (compose-servicenaam, werkt op g5 net zo)
- `mo14.webheaven.nl` → `http://192.168.30.232:8082` (sponsordeck op G4, blijft via LAN bereikbaar)

## Fase 0 — Open beslissingen (vooraf, samen)

1. **bugsink + bugsink_db** (op G4, in compose-project `homeplatform-repo`): laten staan op G4?
   Check waar `SENTRY_DSN` (production-secret) naar wijst — moet vanaf g5 bereikbaar zijn.
2. **portainer** en **cockpit** op G4 laten als beheertools?
3. **Sponsordeck** (`server-mo14-1`, mo14.webheaven.nl): op G4 laten (werkt via LAN door)?
4. **Testtunnel** `g5.webheaven.nl` (`homeplatform_tunnel_g5`): houden als directe g5-ingang of opruimen?
5. **NAS-retentie**: prod-backups 22–27 sept ontbreken op `/mnt/nas-backup/database` — bewust opgeruimd?
6. Downtime-moment: wanneer (rustig moment, geen live-wedstrijden/scans)?

## Fase 1 — Voorbereiding (geen downtime)

1. Host-scripts bijwerken (repo `scripts/`, nu per omgeving aan te roepen met `prod` / `acc`):
   ```bash
   # vanaf de werkplek
   scp -i ~/.ssh/homeplatform scripts/backup-homeplatform.sh scripts/backup-files.sh bart@192.168.30.49:/home/bart/
   scp -i ~/.ssh/homeplatform scripts/backup-homeplatform.sh scripts/backup-files.sh bart@192.168.30.232:/home/bart/
   ssh ... 'sed -i "s/\r$//" /home/bart/backup-*.sh && chmod +x /home/bart/backup-*.sh'   # beide hosts (CRLF!)
   ```
2. `restore-homeplatform.sh` en `services-watcher.sh` (staan alleen op G4) naar g5 kopiëren:
   ```bash
   # op G4
   scp -i /home/bart/.ssh/homeplatform-g5 /home/bart/restore-homeplatform.sh /home/bart/services-watcher.sh bart@192.168.30.49:/home/bart/
   ```
3. Check dat de laatste schaduw-sync recent is: `tail -3 /home/bart/sync-to-g5.log` (G4).

## Fase 2 — Freeze G4 + laatste sync (downtime start)

```bash
# G4
crontab -l > ~/crontab.pre-cutover                       # backup van de crontab
crontab -l | sed 's|^\(\*/15 .*sync-to-g5.sh.*\)|# \1|' | crontab -   # sync-cron uit
docker stop homeplatform_ghost homeplatform_agent_worker homeplatform_backend   # schrijvers stoppen
/home/bart/sync-to-g5.sh                                 # finale db-snapshot -> staging op g5
rsync -az --delete -e "ssh -i /home/bart/.ssh/homeplatform-g5" /home/bart/homeplatform/uploads/   bart@192.168.30.49:/mnt/extra-ssd/uploads/
rsync -az --delete -e "ssh -i /home/bart/.ssh/homeplatform-g5" /home/bart/homeplatform/nas-files/ bart@192.168.30.49:/mnt/extra-ssd/nas-files/
tail -2 /home/bart/sync-to-g5.log                        # moet "sync ok" tonen
```

## Fase 3 — Staging-db promoveren op g5

```bash
# g5
cd /home/bart/homeplatform-repo
docker stop homeplatform_ghost homeplatform_agent_worker homeplatform_backend
cd /home/bart/homeplatform/db
mv homeplatform.sqlite homeplatform.sqlite.g5-pre-cutover      # oude g5-kopie bewaren
rm -f homeplatform.sqlite-wal homeplatform.sqlite-shm
mv homeplatform.sqlite.staging homeplatform.sqlite
chmod 664 homeplatform.sqlite
cd /home/bart/homeplatform-repo
export IMAGE_TAG=$(git rev-parse --short HEAD)                 # moet de main-HEAD zijn (nu 5bdfac9)
docker compose -f docker-compose.g4.yml up -d --force-recreate backend ghost agent_worker
sleep 5
docker exec homeplatform_backend alembic upgrade heads         # b4d6f8a0c2e4 -> c8e0a2b4d6f8 (clublocaties)
docker compose -f docker-compose.g4.yml up -d --no-deps --force-recreate caddy
docker ps --format "{{.Names}}\t{{.Image}}" | grep homeplatform_   # backend/ghost/agent_worker = :<sha>, NIET :latest
```

Controle via de testtunnel (nog vóór de omzetting):
- https://g5.webheaven.nl — inloggen, een paar sites openen, een upload-afbeelding (dontforget/yearof-mo14)
- Data is van "nu": laatste roadmap-item / laatste wedstrijdscan zichtbaar

## Fase 4 — Tunnel omzetten (downtime eindigt)

Eerst G4 stoppen, dan g5 starten — **nooit beide tegelijk**: met hetzelfde token verdeelt Cloudflare
het verkeer over beide connectors.

```bash
# G4
docker update --restart=no homeplatform_cloudflared && docker stop homeplatform_cloudflared
# g5
cd /home/bart/homeplatform-repo && docker compose -f docker-compose.g4.yml up -d --no-deps cloudflared
docker logs --tail 20 homeplatform_cloudflared          # "Registered tunnel connection" x4
```

Controle (vanaf de werkplek):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://webheaven.nl/api/hockey/public/tournaments/05615c6e-5c10-4151-b8a1-691779f8f467/query/regrouping-forecast
# 200 = g5 (G4 heeft deze endpoint niet -> 404)
curl -s -o /dev/null -w "%{http_code}\n" https://mo14.webheaven.nl/      # sponsordeck nog bereikbaar
```

## Fase 5 — Afronden

1. **Clublocaties** (prod-db mist ze na promote):
   `curl -X POST -H "Authorization: Bearer <key>" https://webheaven.nl/api/hockey/clubs/geocode`
2. **Crons g5**:
   ```
   0 3 * * *   [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-homeplatform.sh prod >> /home/bart/backup.log 2>&1
   30 3 * * *  [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-files.sh prod >> /home/bart/backup-files.log 2>&1
   * * * * *   /home/bart/restore-homeplatform.sh >> /home/bart/restore.log 2>&1
   * * * * *   /home/bart/services-watcher.sh >> /home/bart/services.log 2>&1
   ```
   `restore-homeplatform.sh` op g5: alleen `restore_env ""` (prod) laten staan.
   Daarna `rm /home/bart/homeplatform/db/cron_disabled` (g5).
3. **Crons G4**: backups alleen nog acc (`backup-homeplatform.sh acc`, `backup-files.sh acc`),
   `restore-homeplatform.sh` alleen `restore_env "-acc"`, sync-to-g5-regel verwijderen.
   ⚠️ Zonder deze stap overschrijft G4 om 03:00 de echte g5-backup op de NAS met de oude G4-db.
4. **Oude prod-containers G4** niet meer laten herstarten (bugsink/portainer/sponsordeck blijven draaien):
   ```bash
   docker update --restart=no homeplatform_backend homeplatform_ghost homeplatform_agent_worker homeplatform_caddy
   docker stop homeplatform_caddy
   ```
5. **Roadmap**: `.\roadmap.ps1 -Close -Ids "1182,1183,1184" -Version v5.8`
6. **Documentatie**: CLAUDE.md (sectie G4 → g5 als prod), memory `project_server_migratie`.
7. **Volgende ochtend**: `tail /home/bart/backup.log` op g5 en grootte van
   `/mnt/nas-backup/database/prod-homeplatform-<datum>.sqlite` = g5-backup.

## Terugvalplan

- **Vóór fase 4** (tunnel nog op G4): G4 weer starten —
  `docker start homeplatform_backend homeplatform_ghost homeplatform_agent_worker`, sync-cron terug
  (`crontab ~/crontab.pre-cutover`). G4-db is niet aangeraakt, geen dataverlies.
- **Na fase 4**: tunnel terug (`docker stop homeplatform_cloudflared` op g5, `docker update
  --restart=unless-stopped homeplatform_cloudflared && docker start homeplatform_cloudflared` op G4) en
  G4-backend starten. Let op: wijzigingen die sinds de omzetting op g5 zijn gedaan, moeten dan eerst
  terug naar G4 (sqlite `.backup()` van g5 → G4), anders gaan ze verloren.

## Achtergrond — fixes van 05-10

- Deploy-pipeline g5: `git pull` → `fetch` + `reset --hard` (init+fetch-repo zonder tracking-branch);
  Caddy-reload recreëerde de backend met oud `:latest` → nu `--no-deps` + `IMAGE_TAG`.
- g5-backupcron overschreef de G4-prod-backup op de NAS (zelfde bestandsnaam, g5 draait na G4):
  g5-crons uit via `cron_disabled`, NAS-backups van 02/04/05-10 hersteld uit de lokale G4-backups.
- Pipeline bouwt de prod-frontend op G4 in de live dist-map → tot de cutover draait webheaven.nl een
  nieuwe frontend op een oude backend (o.a. "No forecast available" in Poulebord). Lost zich op met de cutover.
