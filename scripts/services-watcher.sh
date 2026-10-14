#!/bin/bash
# Schrijft de status van de GitHub Actions-runner naar db/runner_status.json en de cron jobs van deze host
# naar db/crontab.json (beide getoond in admin Infrastructuur), en herstart de runner als de admin-UI daarom
# vraagt (db/restart_runner-vlag).
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

# Cron jobs van deze host voor admin Infrastructuur (crontab.json): schema, commando, log en laatste logwijziging
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
cron_json() {
    local out="" line sched cmd log mtime
    while IFS= read -r line; do
        case "$line" in ''|\#*) continue ;; esac
        echo "$line" | grep -qE '^[A-Za-z_]+=' && continue          # MAILTO=, PATH=, ...
        if [ "${line:0:1}" = "@" ]; then
            sched=$(echo "$line" | awk '{print $1}')
            cmd=$(echo "$line" | awk '{$1=""; sub(/^ +/, ""); print}')
        else
            sched=$(echo "$line" | awk '{print $1, $2, $3, $4, $5}')
            cmd=$(echo "$line" | awk '{$1=$2=$3=$4=$5=""; sub(/^ +/, ""); print}')
        fi
        log=$(echo "$cmd" | sed -n 's/.*>> *\([^ ;&|]*\).*/\1/p')
        mtime=""
        [ -n "$log" ] && mtime=$(stat -c %Y "$log" 2>/dev/null)
        out="$out${out:+,}{\"schedule\":\"$(esc "$sched")\",\"command\":\"$(esc "$cmd")\",\"log\":\"$(esc "$log")\",\"log_mtime\":${mtime:-null}}"
    done < <(crontab -l 2>/dev/null)
    printf '{"checked_at":"%s","jobs":[%s]}\n' "$TIMESTAMP" "$out"
}
CRON_JSON=$(cron_json)

RESTART_REQUESTED=0
for DB_DIR in "${DB_DIRS[@]}"; do
    [ -d "$DB_DIR" ] || continue
    printf "{\"status\":\"%s\",\"service\":\"%s\",\"checked_at\":\"%s\"}\n" "$STATUS" "${RUNNER_SVC:-unknown}" "$TIMESTAMP" > "$DB_DIR/runner_status.json"
    echo "$CRON_JSON" > "$DB_DIR/crontab.json"
    if [ -f "$DB_DIR/restart_runner" ]; then
        rm -f "$DB_DIR/restart_runner"
        RESTART_REQUESTED=1
    fi
done

if [ "$RESTART_REQUESTED" -eq 1 ] && [ -n "$RUNNER_SVC" ]; then
    sudo systemctl restart "$RUNNER_SVC" >> /home/bart/runner-restart.log 2>&1
    echo "$(date): Restarted $RUNNER_SVC" >> /home/bart/runner-restart.log
fi
