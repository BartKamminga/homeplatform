#!/bin/bash
# Houdt het publieke IP van thuis bij als toegestaan adres voor acc.webheaven.nl (Caddyfile.acc, item 1191).
# G4 staat thuis, dus zijn eigen publieke IP is het thuis-IP (ook onderweg via Teleport-VPN). Wijzigt het,
# dan schrijft dit script een nieuw allow-bestand en herlaadt het Caddy in de acc-container.
# Status voor admin Infrastructuur: db/acc_access.json.
# Alleen op G4 (acc): */30 * * * * /home/bart/acc-home-ip.sh >> /home/bart/acc-home-ip.log 2>&1
ALLOW_DIR=/home/bart/homeplatform-acc/caddy-allow
ALLOW_FILE=$ALLOW_DIR/home.caddy
CHANGED_FILE=$ALLOW_DIR/home.changed
STATUS_FILE=/home/bart/homeplatform-acc/db/acc_access.json
ENV_FILE=/home/bart/homeplatform-repo-acc/.env
CONTAINER=homeplatform_caddy_acc
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# IP zoals Cloudflare het ziet (= Cf-Connecting-IP in Caddy); IPv6 alleen als de verbinding dat heeft
ip_via() { curl -s "$1" --max-time 10 https://www.cloudflare.com/cdn-cgi/trace | sed -n 's/^ip=//p'; }
json_list() { local out="" x; for x in "$@"; do out="$out${out:+,}\"$x\""; done; echo "[$out]"; }

write_status() {   # $1 = ok|error, $2 = melding
    local extra
    extra=$(sed -n 's/^ACC_ALLOWED_IPS=//p' "$ENV_FILE" 2>/dev/null)
    printf '{"status":"%s","message":"%s","home_ips":%s,"extra_ips":%s,"changed_at":"%s","checked_at":"%s"}\n' \
        "$1" "$2" "$(json_list $(sed 's/^client_ip //' "$ALLOW_FILE" 2>/dev/null))" "$(json_list $extra)" \
        "$(cat "$CHANGED_FILE" 2>/dev/null)" "$NOW" > "$STATUS_FILE"
}

mkdir -p "$ALLOW_DIR"
IPV4=$(ip_via -4)
IPV6=$(ip_via -6)

if [ -z "$IPV4" ] && [ -z "$IPV6" ]; then
    echo "$(date): geen publiek IP opgehaald, allow-bestand ongewijzigd"
    write_status error "Could not fetch public IP - previous home IP kept"
    exit 1
fi

NEW=$(echo "client_ip $IPV4 $IPV6" | sed 's/ *$//')
if [ "$(cat "$ALLOW_FILE" 2>/dev/null)" = "$NEW" ]; then
    write_status ok ""
    exit 0
fi

echo "$NEW" > "$ALLOW_FILE"
echo "$NOW" > "$CHANGED_FILE"
if docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    echo "$(date): thuis-IP bijgewerkt: $IPV4 $IPV6"
    write_status ok ""
else
    echo "$(date): thuis-IP bijgewerkt naar $IPV4 $IPV6, maar caddy reload mislukt (container down?)"
    write_status error "Home IP changed but Caddy reload failed - active after the next acc deploy"
fi
