#!/bin/bash
# Dagelijkse SQLite-backup (prod + acc), lokaal + kopie naar NAS.
# Draait via cron op de host (G4): 0 3 * * * [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-homeplatform.sh >> /home/bart/backup.log 2>&1
# Vereist: /mnt/nas-backup gemount (zie scripts/README.md).
set -e
DATE=$(date +%Y-%m-%d)
LOG="/home/bart/backup.log"
NAS_MOUNT="/mnt/nas-backup"

write_nas_index() {
    local OUT=$1 DIR=$2 LBL=$3 MOUNTED=0
    mountpoint -q "$NAS_MOUNT" && MOUNTED=1
    python3 - "$OUT" "$DIR" "$LBL" "$MOUNTED" <<'PY'
import datetime, json, os, sys
out, nas_dir, label, mounted = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
files = sorted(f for f in os.listdir(nas_dir) if f.startswith(label + "-")) if mounted and os.path.isdir(nas_dir) else []
with open(out, "w") as fh:
    json.dump({"checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "mounted": mounted, "label": label, "files": files}, fh)
PY
}

backup_env() {
    local ENV=$1
    local DB="/home/bart/homeplatform${ENV}/db/homeplatform.sqlite"
    local BACKUP_DIR="/home/bart/homeplatform${ENV}/db/backups"
    local NAS_DIR="$NAS_MOUNT/database"
    local LABEL="prod"; [ -n "$ENV" ] && LABEL="acc"

    if [ ! -f "$DB" ]; then echo "[$LABEL] DB niet gevonden: $DB" >> $LOG; return; fi

    mkdir -p "$BACKUP_DIR"
    local TARGET="$BACKUP_DIR/homeplatform-$DATE.sqlite"

    python3 -c "
import sqlite3
src = sqlite3.connect('$DB')
dst = sqlite3.connect('$TARGET')
src.backup(dst)
dst.close(); src.close()
"
    SIZE=$(du -sh "$TARGET" | cut -f1)
    echo "[$(date +%H:%M)] [$LABEL] backup ok: homeplatform-$DATE.sqlite ($SIZE)" >> $LOG

    # Kopieer naar NAS (apart backup-share, niet meer de Music-share).
    # Alleen als de share echt gemount is: anders schrijft cp naar de lokale map onder het
    # mountpunt en verdwijnt de kopie uit zicht zodra de mount terugkomt (gebeurd 21-24 sept).
    if ! mountpoint -q "$NAS_MOUNT"; then
        echo "[$LABEL] NAS mislukt: $NAS_MOUNT niet gemount" >> $LOG
    else
        mkdir -p "$NAS_DIR"
        cp "$TARGET" "$NAS_DIR/${LABEL}-homeplatform-$DATE.sqlite" 2>/dev/null \
            && echo "[$LABEL] NAS ok" >> $LOG \
            || echo "[$LABEL] NAS mislukt (doorgaan)" >> $LOG
    fi

    # Index voor de admin Infrastructuur-pagina (item 1190): was de NAS gemount, en welke backups
    # van deze omgeving staan er (zo zie je ook later verdwenen NAS-bestanden).
    write_nas_index "$BACKUP_DIR/nas_index.json" "$NAS_DIR" "$LABEL"

    # Bewaar max 14 dagelijkse lokale backups
    ls -t "$BACKUP_DIR"/homeplatform-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f
}

echo "--- backup $DATE ---" >> $LOG
# Welke omgevingen: argumenten "prod" en/of "acc" (default: beide, oude gedrag).
# Na de g4->g5-cutover: g5 draait alleen "prod", G4 alleen "acc" - anders
# schrijven beide hosts naar dezelfde NAS-bestandsnaam en overschrijven ze elkaar.
for ENV_NAME in "${@:-prod acc}"; do
    for E in $ENV_NAME; do
        case "$E" in
            prod) backup_env "" ;;      # /home/bart/homeplatform
            acc)  backup_env "-acc" ;;  # /home/bart/homeplatform-acc
            *)    echo "Onbekende omgeving: $E" >> "$LOG" ;;
        esac
    done
done
