#!/bin/bash
# Snapshot van de SQLite-db vóór een deploy (vóór alembic upgrade), aangeroepen vanuit deploy.yml.
# Gebruik: db-snapshot-predeploy.sh <db-pad> <label>   (label = korte commit-sha)
# Bewaart de laatste 10 pre-deploy-snapshots naast de dagelijkse backups in <db-dir>/backups/.
# Faalt de snapshot, dan faalt het script -> deploy wordt afgebroken vóór de migraties.
set -euo pipefail

DB="$1"
LABEL="$2"
KEEP=10

if [ ! -f "$DB" ]; then
    echo "Geen db op $DB (verse installatie?) - snapshot overgeslagen"
    exit 0
fi

BACKUP_DIR="$(dirname "$DB")/backups"
mkdir -p "$BACKUP_DIR"
TARGET="$BACKUP_DIR/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$LABEL.sqlite"

# sqlite backup-API: consistent, ook terwijl de backend (WAL-mode) erin schrijft.
python3 - "$DB" "$TARGET" <<'EOF'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1])
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
ok = dst.execute("PRAGMA quick_check").fetchone()[0]
dst.close(); src.close()
if ok != "ok":
    sys.exit(f"quick_check op snapshot faalde: {ok}")
EOF

echo "Snapshot ok: $TARGET ($(du -sh "$TARGET" | cut -f1))"
ls -t "$BACKUP_DIR"/pre-deploy-*.sqlite | tail -n +$((KEEP + 1)) | xargs -r rm -f
