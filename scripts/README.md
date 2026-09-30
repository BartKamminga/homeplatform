# Host-scripts (G4/G5)

Deze scripts draaien niet in Docker maar rechtstreeks op de hostmachine (cron). Ze staan hier voor
zichtbaarheid/versiebeheer; op de server zelf staan ze los in `/home/bart/` en worden ze bij
wijzigingen handmatig gekopieerd (geen auto-deploy voor host-scripts).

## Vereiste NAS-mount

Beide scripts schrijven naar `/mnt/nas-backup` — een apart (schrijfbaar) CIFS-mountpunt, los van de
read-only `music`-mount (die is voor mixmusic-audio, niet voor backups).

```bash
sudo mkdir -p /mnt/nas-backup
echo "//192.168.30.194/homeplatform/backups  /mnt/nas-backup  cifs  credentials=/etc/homeplatform-nas.creds,uid=1000,gid=1000,iocharset=utf8,_netdev  0  0" | sudo tee -a /etc/fstab
sudo mount -a
df -h /mnt/nas-backup
```

## backup-homeplatform.sh

Dagelijkse SQLite-snapshot (prod + acc), lokaal bewaard (14 dagen) + kopie naar
`/mnt/nas-backup/database/`. Vervangt de oudere versie die naar `music/.hp_backups/` schreef.

Cron (ongewijzigd t.o.v. de bestaande entry, alleen het script zelf is aangepast):
```
0 3 * * * [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-homeplatform.sh >> /home/bart/backup.log 2>&1
```

## backup-files.sh

Dagelijkse rsync van `uploads/` en `nas-files/` (prod + acc) naar `/mnt/nas-backup/files/`.
Geen `--delete` — een lokale verwijdering mag nooit de NAS-kopie meeslepen.

Cron (nieuw, 30 min na de DB-backup):
```
30 3 * * * [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-files.sh >> /home/bart/backup-files.log 2>&1
```

## Overige host-scripts (nog niet in de repo)

- `restore-homeplatform.sh` — leest de `pending_restore`-vlag (gezet via de admin-UI) en voert de
  daadwerkelijke restore + backend-herstart uit. Draait elke minuut.
- `services-watcher.sh` — bewaakt/herstelt de GitHub Actions runner en overige services. Draait elke
  minuut.
