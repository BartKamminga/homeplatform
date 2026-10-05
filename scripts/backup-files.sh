#!/bin/bash
# Dagelijkse bestanden-backup (uploads/ + nas-files/) voor prod + acc naar de NAS.
# Géén --delete: een per-ongeluk lokale verwijdering mag nooit de NAS-kopie meeslepen.
# Draait via cron op de host: 30 3 * * * [ ! -f /home/bart/homeplatform/db/cron_disabled ] && /home/bart/backup-files.sh >> /home/bart/backup-files.log 2>&1
# Vereist: /mnt/nas-backup gemount (zie scripts/README.md).
set -e
LOG="/home/bart/backup-files.log"
NAS_DIR="/mnt/nas-backup/files"

backup_env() {
    local ENV=$1
    local UPLOADS="/home/bart/homeplatform${ENV}/uploads"
    local NASFILES="/home/bart/homeplatform${ENV}/nas-files"
    # g5: prod-bestanden staan op de extra datadisk (docker-compose.g4.yml-volumes)
    if [ -z "$ENV" ] && [ -d /mnt/extra-ssd/uploads ]; then
        UPLOADS="/mnt/extra-ssd/uploads"
        NASFILES="/mnt/extra-ssd/nas-files"
    fi
    local LABEL="prod"; [ -n "$ENV" ] && LABEL="acc"

    mkdir -p "$NAS_DIR/$LABEL/uploads" "$NAS_DIR/$LABEL/nas-files"

    if [ -d "$UPLOADS" ]; then
        rsync -a "$UPLOADS/" "$NAS_DIR/$LABEL/uploads/" \
            && echo "[$(date +%H:%M)] [$LABEL] uploads sync ok" >> $LOG \
            || echo "[$LABEL] uploads sync mislukt (doorgaan)" >> $LOG
    else
        echo "[$LABEL] uploads niet gevonden: $UPLOADS" >> $LOG
    fi

    if [ -d "$NASFILES" ]; then
        rsync -a "$NASFILES/" "$NAS_DIR/$LABEL/nas-files/" \
            && echo "[$(date +%H:%M)] [$LABEL] nas-files sync ok" >> $LOG \
            || echo "[$LABEL] nas-files sync mislukt (doorgaan)" >> $LOG
    else
        echo "[$LABEL] nas-files niet gevonden: $NASFILES" >> $LOG
    fi
}

echo "--- files backup $(date +%Y-%m-%d) ---" >> $LOG
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
