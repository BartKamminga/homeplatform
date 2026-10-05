#!/bin/bash
# "Schaduw"-sync tijdens de wachtperiode voor de g4->g5 cutover: houdt g5's
# kopie van db/uploads/nas-files vers zodat de uiteindelijke cutover alleen
# nog een kleine delta + tunnel-omzetting is, i.p.v. een volledige sync.
# Bron = G4 (nog steeds de live prod-omgeving tot de cutover).
#
# Draait via cron op G4:
#   */15 * * * * /home/bart/sync-to-g5.sh >> /home/bart/sync-to-g5.log 2>&1
set -e

G5_HOST="bart@192.168.30.49"
G5_SSH="ssh -i /home/bart/.ssh/homeplatform-g5"
SRC_DB="/home/bart/homeplatform/db/homeplatform.sqlite"
SRC_UPLOADS="/home/bart/homeplatform/uploads/"
SRC_NAS="/home/bart/homeplatform/nas-files/"
TMP_SNAPSHOT="/home/bart/homeplatform/db/.sync-staging.sqlite"
LOG="/home/bart/sync-to-g5.log"

echo "--- sync $(date -u +%Y-%m-%dT%H:%M:%SZ) ---" >> "$LOG"

# 1. Veilige hot-copy van de db (zelfde sqlite3 .backup()-patroon als de
#    dagelijkse backup in backup-homeplatform.sh — geen kans op een corrupt
#    tussentijds bestand, ook niet terwijl de live backend erin schrijft).
python3 -c "
import sqlite3
src = sqlite3.connect('$SRC_DB')
dst = sqlite3.connect('$TMP_SNAPSHOT')
src.backup(dst)
dst.close(); src.close()
"
DB_SIZE=$(stat -c%s "$TMP_SNAPSHOT")

# 2. Naar een staging-pad op g5 — NIET het actieve db-bestand. g5's eigen
#    backend-container heeft dat al open (draait al sinds de laatste
#    main-deploy, al krijgt hij geen echt verkeer); overschrijven terwijl
#    die draait kan tot een inconsistente state leiden. Bij de cutover zelf:
#    backend op g5 kort stoppen, staging -> actief pad, weer starten.
rsync -az -e "$G5_SSH" "$TMP_SNAPSHOT" "$G5_HOST:/home/bart/homeplatform/db/homeplatform.sqlite.staging"
rm -f "$TMP_SNAPSHOT"

# 3. Uploads en nas-files — bewust geen --delete, nooit per ongeluk iets
#    weggooien op g5 als het op G4 al verwijderd is; bij de cutover wordt
#    dit met --delete definitief gelijkgetrokken.
rsync -az -e "$G5_SSH" "$SRC_UPLOADS" "$G5_HOST:/mnt/extra-ssd/uploads/"
rsync -az -e "$G5_SSH" "$SRC_NAS"     "$G5_HOST:/mnt/extra-ssd/nas-files/"

# 4. Statusmanifest — zichtbaar in de admin-UI (Infrastructuur-pagina) op
#    zowel G4 als g5, zodat je in een oogopslag ziet hoe vers de kopie is.
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > /home/bart/homeplatform/db/sync_status.json << EOF
{"last_sync_at":"$TS","db_bytes":$DB_SIZE,"target":"g5","staging":true}
EOF
rsync -az -e "$G5_SSH" /home/bart/homeplatform/db/sync_status.json "$G5_HOST:/home/bart/homeplatform/db/sync_status.json"

echo "[$(date +%H:%M)] sync ok (db ${DB_SIZE}b)" >> "$LOG"
