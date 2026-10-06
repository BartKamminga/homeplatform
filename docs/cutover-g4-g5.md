# Cutover G4 → g5 (prod) — stappenplan

Opgesteld 05-10-2026, bijgewerkt 06-10-2026 (nieuwe pipeline, item 1187 — eerst live op g5, dan cutover). Doel: `webheaven.nl` laten bedienen door g5
(192.168.30.49) in plaats van G4 (192.168.30.232). G4 blijft daarna acc + beheer-/dev-host.

Geschatte duur: 60–90 min, waarvan **~5–10 min downtime** (fase 2 t/m 4).

SSH: `ssh -i ~/.ssh/homeplatform bart@192.168.30.232` (G4) en `... bart@192.168.30.49` (g5).

## Uitgangssituatie (gecontroleerd 05-10)

| | G4 (live) | g5 |
|---|---|---|
| Verkeer webheaven.nl | ✅ via `homeplatform_cloudflared` (token-tunnel) | ❌ alleen testtunnel `g5.webheaven.nl` |
| Backend | oud image (26-09), container sinds 30-09 | `5bdfac9` (v5.8), correct |
| DB | live, alembic `b4d6f8a0c2e4` | eigen kopie; staging-db elke 15 min ververst |
| Frontend | stand van de laatste oude-pipeline-build (de nieuwe pipeline raakt G4-prod niet meer) | in het web-image (`homeplatform-web:<sha>`) |
| Crons | backup, backup-files, restore, services-watcher, sync-to-g5 | backup + backup-files — **tijdelijk uit** via `db/cron_disabled` |

Tunnel-ingress (Cloudflare, remote-managed, token in `.env` als `CLOUDFLARE_TUNNEL_TOKEN`):
- `webheaven.nl` → `http://caddy:80` (compose-servicenaam, werkt op g5 net zo)
- `mo14.webheaven.nl` → `http://192.168.30.232:8082` (sponsordeck op G4, blijft via LAN bereikbaar)

## Fase 0 — Besluiten (06-10)

1. **bugsink + bugsink_db** blijven op G4. `SENTRY_DSN` (production-secret) wees naar `http://…@bugsink:8090`
   (compose-naam, bestaat niet op g5) → host wordt `192.168.30.232:8090` (zie fase 1).
2. **portainer**, **cockpit** en **sponsordeck** (`server-mo14-1`) blijven op G4.
3. **Testtunnel** `g5.webheaven.nl` wordt na de cutover opgeruimd (fase 5).
4. Nog open: NAS-retentie prod-backups 22–27 sept, en het downtime-moment.

## Fase 1 — Voorbereiding (geen downtime)

0. **Nieuwe pipeline live op g5** (item 1187): eerst via develop/acc, dan main. Check op g5 dat alle vier
   de containers op `:<sha>` draaien, inclusief `homeplatform_caddy` = `homeplatform-web:<sha>`.
   Vóór die main-deploy de secret `SENTRY_DSN` (environment `production`) aanpassen: host `bugsink`
   → `192.168.30.232`, zodat de deploy de juiste `.env` schrijft. Controle: test-error in admin → zichtbaar in bugsink.
1. ✅ (06-10) Host-scripts in de repo (`scripts/`) en op beide hosts in `/home/bart/` (oude versies als
   `*.bak-20261006`): `backup-homeplatform.sh`, `backup-files.sh` (nu met NAS-mountcontrole, item 1188),
   `restore-homeplatform.sh` (nu per omgeving + fix containernaam acc), `services-watcher.sh`.
   Alle vier per omgeving aan te roepen (`prod` / `acc`); zonder argument = beide (oude gedrag).
2. ⏳ **sudo-regel op g5** voor `services-watcher.sh` (runner herstarten vanuit admin) — Bart, met sudo:
   ```bash
   echo 'bart ALL=(root) NOPASSWD: /usr/bin/systemctl restart actions.runner.*' | sudo tee /etc/sudoers.d/homeplatform-runner
   sudo chmod 440 /etc/sudoers.d/homeplatform-runner && sudo visudo -c
   ```
3. ✅ (06-10) Schaduw-sync recent (elke 15 min `sync ok`), g5 gezond (196 GB vrij, 13 GB RAM vrij).
4. ⏳ **Besluit dev-sessions**: op g5 ontbreken de deploy-key (`/home/bart/homeplatform/secrets/claude-agent-deploy-key`)
   en het image `homeplatform-claude-agent`. Na de cutover start prod de sessions op g5 → falen, tot item 1165.

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
export IMAGE_TAG=$(git rev-parse --short=7 HEAD)               # moet de main-HEAD zijn
docker compose -f docker-compose.g4.yml up -d --force-recreate backend ghost agent_worker
sleep 5
docker exec homeplatform_backend alembic upgrade heads         # b4d6f8a0c2e4 -> c8e0a2b4d6f8 (clublocaties)
docker compose -f docker-compose.g4.yml up -d --no-deps --force-recreate caddy
docker ps --format "{{.Names}}\t{{.Image}}" | grep homeplatform_   # alle vier (ook caddy = homeplatform-web) op :<sha>
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
# g5 (IMAGE_TAG is verplicht voor elk compose-commando op deze file)
cd /home/bart/homeplatform-repo && export IMAGE_TAG=$(git rev-parse --short=7 HEAD)
docker compose -f docker-compose.g4.yml up -d --no-deps cloudflared
docker logs --tail 20 homeplatform_cloudflared          # "Registered tunnel connection" x4
```

Controle (vanaf de werkplek):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://webheaven.nl/api/hockey/public/tournaments/05615c6e-5c10-4151-b8a1-691779f8f467/query/regrouping-forecast
# 200 = g5 (G4 heeft deze endpoint niet -> 404)
curl -s -o /dev/null -w "%{http_code}\n" https://mo14.webheaven.nl/      # sponsordeck nog bereikbaar
```

## Fase 5 — Afronden

0. **Lokale CLI-configs naar g5** (werkplek, gitignored) — direct na fase 4, anders schrijven
   `roadmap.ps1` en `MindBox.ps1 -Env prod` naar de gestopte G4-backend:
   `.roadmap.config.ps1` en `.mindbox.config.prod.ps1`: `$HP_API_BASE = "http://192.168.30.49:8080/api"`.
   De API-keys blijven geldig (zitten in de gepromoveerde db). Acc (`PROD_API_BASE`) en de Chrome-plugins
   gebruiken `https://webheaven.nl` en hoeven niet aangepast.
1. **Clublocaties** (prod-db mist ze na promote), met de roadmap-key (`hp_…`, werkt op elk ingelogd endpoint):
   `curl -X POST -H "Authorization: Bearer <key>" https://webheaven.nl/api/hockey/clubs/geocode`
2. **Crons g5**:
   ```
   0 3 * * *   [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-homeplatform.sh prod >> /home/bart/backup.log 2>&1
   30 3 * * *  [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-files.sh prod >> /home/bart/backup-files.log 2>&1
   * * * * *   /home/bart/restore-homeplatform.sh prod >> /home/bart/restore.log 2>&1
   * * * * *   /home/bart/services-watcher.sh >> /home/bart/services.log 2>&1
   ```
   Daarna `rm /home/bart/homeplatform/db/cron_disabled` (g5).
3. **Crons G4**: backups alleen nog acc (`backup-homeplatform.sh acc`, `backup-files.sh acc`),
   `restore-homeplatform.sh acc`, sync-to-g5-regel verwijderen.
   ⚠️ Zonder deze stap overschrijft G4 om 03:00 de echte g5-backup op de NAS met de oude G4-db.
4. **Oude prod-containers G4** niet meer laten herstarten (bugsink/portainer/sponsordeck blijven draaien):
   ```bash
   docker update --restart=no homeplatform_backend homeplatform_ghost homeplatform_agent_worker homeplatform_caddy
   docker stop homeplatform_caddy
   ```
5. **Testtunnel opruimen** (g5): `docker rm -f homeplatform_tunnel_g5`; in Cloudflare de tunnel
   `homeplatform-g5` + DNS-record `g5.webheaven.nl` verwijderen.
6. **G4-prod-repo** (`/home/bart/homeplatform-repo`) wordt door de pipeline niet meer bijgewerkt; daar
   draaien alleen nog bugsink/bugsink_db uit. Niet `git pull`-en zonder te beseffen dat de nieuwe
   compose-file `IMAGE_TAG` verplicht stelt.
7. **Roadmap**: `.\roadmap.ps1 -Close -Ids "1182,1183,1184" -Version v5.8`
8. **Documentatie**: CLAUDE.md (sectie G4 → g5 als prod), memory `project_server_migratie`.
9. **Volgende ochtend**: `tail /home/bart/backup.log` op g5 en grootte van
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
- Pipeline bouwde de prod-frontend op G4 in de live dist-map → webheaven.nl draaide een nieuwe frontend
  op een oude backend (o.a. "No forecast available" in Poulebord). Opgelost met item 1187: build in de
  runner-workspace, frontend zit in het web-image, gaat pas live na geslaagde migraties.
