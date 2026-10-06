#!/bin/bash
# Voert een restore uit die vanuit de admin-UI is aangevraagd (pending_restore-vlag in db/backups/).
# Draait elke minuut via cron op de host:
#   * * * * * /home/bart/restore-homeplatform.sh prod >> /home/bart/restore.log 2>&1   (g5)
#   * * * * * /home/bart/restore-homeplatform.sh acc  >> /home/bart/restore.log 2>&1   (G4)
# Zonder argument: beide omgevingen (oude gedrag).
LOG="/home/bart/restore.log"

restore_env() {
    local ENV=$1                                   # "" (prod) of "-acc"
    local CONTAINER="homeplatform_backend${ENV/-/_}"   # homeplatform_backend / homeplatform_backend_acc
    local DB="/home/bart/homeplatform${ENV}/db/homeplatform.sqlite"
    local BACKUP_DIR="/home/bart/homeplatform${ENV}/db/backups"
    local FLAG="$BACKUP_DIR/pending_restore"

    [ ! -f "$FLAG" ] && return

    FILENAME=$(cat "$FLAG")
    BACKUP="$BACKUP_DIR/$FILENAME"

    if [ ! -f "$BACKUP" ]; then
        echo "[$(date)] FOUT: $BACKUP niet gevonden" >> $LOG
        rm -f "$FLAG"; return
    fi

    echo "[$(date)] Restore starten (${ENV:-prod}): $FILENAME" >> $LOG
    rm -f "$FLAG"

    docker stop "$CONTAINER" 2>/dev/null || true
    cp "$DB" "$DB.pre-restore.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    # WAL/SHM van de oude db weg, anders past sqlite ze toe op de teruggezette db
    rm -f "$DB-wal" "$DB-shm"
    cp "$BACKUP" "$DB"
    chmod 664 "$DB"
    docker start "$CONTAINER" 2>/dev/null || true

    echo "[$(date)] Restore klaar: $FILENAME" >> $LOG
}

for E in ${@:-prod acc}; do
    case "$E" in
        prod) restore_env "" ;;
        acc)  restore_env "-acc" ;;
        *)    echo "[$(date)] Onbekende omgeving: $E" >> $LOG ;;
    esac
done
