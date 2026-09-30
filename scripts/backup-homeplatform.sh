#!/bin/bash
# Dagelijkse SQLite-backup (prod + acc), lokaal + kopie naar NAS.
# Draait via cron op de host (G4): 0 3 * * * [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-homeplatform.sh >> /home/bart/backup.log 2>&1
# Vereist: /mnt/nas-backup gemount (zie scripts/README.md).
set -e
DATE=$(date +%Y-%m-%d)
LOG="/home/bart/backup.log"

backup_env() {
    local ENV=$1
    local DB="/home/bart/homeplatform${ENV}/db/homeplatform.sqlite"
    local BACKUP_DIR="/home/bart/homeplatform${ENV}/db/backups"
    local NAS_DIR="/mnt/nas-backup/database"
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

    # Kopieer naar NAS (apart backup-share, niet meer de Music-share)
    mkdir -p "$NAS_DIR"
    cp "$TARGET" "$NAS_DIR/${LABEL}-homeplatform-$DATE.sqlite" 2>/dev/null \
        && echo "[$LABEL] NAS ok" >> $LOG \
        || echo "[$LABEL] NAS mislukt (doorgaan)" >> $LOG

    # Bewaar max 14 dagelijkse lokale backups
    ls -t "$BACKUP_DIR"/homeplatform-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f
}

echo "--- backup $DATE ---" >> /home/bart/backup.log
backup_env ""      # prod: /home/bart/homeplatform
backup_env "-acc"  # acc:  /home/bart/homeplatform-acc
