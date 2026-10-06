#!/bin/bash
# Schrijft de status van de GitHub Actions-runner naar db/runner_status.json (getoond in admin
# Infrastructuur) en herstart de runner als de admin-UI daarom vraagt (db/restart_runner-vlag).
# Draait elke minuut via cron op de host: * * * * * /home/bart/services-watcher.sh >> /home/bart/services.log 2>&1
# Vereist sudo zonder wachtwoord voor 'systemctl restart actions.runner.*'.
DB_DIRS=(/home/bart/homeplatform/db /home/bart/homeplatform-acc/db)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

RUNNER_SVC=$(systemctl list-units --type=service --no-legend 2>/dev/null | grep -o "actions\.runner\.[^ .]*\.[^ ]*\.service" | head -1 | sed "s/\.service$//")

if [ -n "$RUNNER_SVC" ] && systemctl is-active --quiet "$RUNNER_SVC" 2>/dev/null; then
    STATUS="online"
elif [ -n "$RUNNER_SVC" ]; then
    STATUS="offline"
else
    STATUS="unknown"
fi

RESTART_REQUESTED=0
for DB_DIR in "${DB_DIRS[@]}"; do
    [ -d "$DB_DIR" ] || continue
    printf "{\"status\":\"%s\",\"service\":\"%s\",\"checked_at\":\"%s\"}\n" "$STATUS" "${RUNNER_SVC:-unknown}" "$TIMESTAMP" > "$DB_DIR/runner_status.json"
    if [ -f "$DB_DIR/restart_runner" ]; then
        rm -f "$DB_DIR/restart_runner"
        RESTART_REQUESTED=1
    fi
done

if [ "$RESTART_REQUESTED" -eq 1 ] && [ -n "$RUNNER_SVC" ]; then
    sudo systemctl restart "$RUNNER_SVC" >> /home/bart/runner-restart.log 2>&1
    echo "$(date): Restarted $RUNNER_SVC" >> /home/bart/runner-restart.log
fi
