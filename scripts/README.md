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

## Omgeving per host (sinds de g4->g5-cutover)

`backup-homeplatform.sh` en `backup-files.sh` accepteren `prod` en/of `acc` als argument (zonder
argument: beide). g5 (prod) draait ze met `prod`, G4 (acc) met `acc` — beide schrijven naar
dezelfde NAS-bestandsnamen, dus nooit allebei dezelfde omgeving laten back-uppen.
Zie `docs/cutover-g4-g5.md`.

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

## NAS-mountcontrole

Beide backup-scripts controleren met `mountpoint -q /mnt/nas-backup` of de share echt gemount is.
Zonder die check schreef `cp`/`rsync` bij een mislukte mount naar de lokale map onder het mountpunt:
21–24 sept 2026 gaven zo "NAS ok" terwijl de kopieën op G4's eigen schijf belandden (NAS-IP was
gewijzigd, mount faalde na een reboot). Nu: `NAS mislukt: ... niet gemount` in het log.

## restore-homeplatform.sh

Leest de `pending_restore`-vlag (gezet via de admin-UI) en voert de restore uit: backend stoppen,
huidige db bewaren als `.pre-restore.<tijd>`, backup terugzetten, backend starten. Per omgeving:
```
* * * * * /home/bart/restore-homeplatform.sh prod >> /home/bart/restore.log 2>&1   # g5
* * * * * /home/bart/restore-homeplatform.sh acc  >> /home/bart/restore.log 2>&1   # G4
```

## services-watcher.sh

Schrijft de runner-status naar `db/runner_status.json` (admin Infrastructuur) en herstart de
GitHub Actions-runner op verzoek van de admin-UI. Vereist sudo zonder wachtwoord voor
`systemctl restart actions.runner.*`.
```
* * * * * /home/bart/services-watcher.sh >> /home/bart/services.log 2>&1
```

## Uitrollen

Host-scripts gaan niet mee met de deploy-pipeline. Na een wijziging naar beide hosts kopiëren:
```bash
scp -i ~/.ssh/homeplatform scripts/<script>.sh bart@<host>:/home/bart/
ssh -i ~/.ssh/homeplatform bart@<host> 'sed -i "s/\r$//" /home/bart/<script>.sh && chmod +x /home/bart/<script>.sh'
```
