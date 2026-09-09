#!/bin/bash
# Draai op de G4 (host, niet in de container) om een dev-session weer op te
# pakken na een Remote Control-disconnect (netwerkhapering, ~10 min zonder
# verbinding beeindigt het claude-proces) of na een herstart van de container
# zelf (geen restart-policy, dus na een reboot staat 'ie uit).
#
# Gebruik: ./resume-session.sh <container_name>
set -e

CONTAINER="$1"
if [ -z "$CONTAINER" ]; then
    echo "Gebruik: $0 <container_name>"
    echo "Beschikbare dev-sessions:"
    docker ps -a --filter "name=homeplatform_devsession_" --format "  {{.Names}}  ({{.Status}})"
    exit 1
fi

STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null) || { echo "Container '$CONTAINER' niet gevonden"; exit 1; }
if [ "$STATUS" != "running" ]; then
    echo "Container was '$STATUS' - starten..."
    docker start "$CONTAINER"
    sleep 1
fi

docker exec "$CONTAINER" tmux has-session -t work 2>/dev/null \
    || docker exec -d "$CONTAINER" tmux new-session -d -s work -c /workspace

# Alleen 'claude' (opnieuw) starten als het nog niet de actieve foreground-
# command in de pane is - anders typen we per ongeluk tekst in een sessie
# die al gewoon draait.
CURRENT_CMD=$(docker exec "$CONTAINER" tmux list-panes -t work -F '#{pane_current_command}' 2>/dev/null | head -1)
if [ "$CURRENT_CMD" != "claude" ] && [ "$CURRENT_CMD" != "node" ]; then
    echo "claude nog niet actief in de sessie - starten..."
    docker exec "$CONTAINER" tmux send-keys -t work "claude" Enter
    sleep 1
fi

echo "Verbinden... (Ctrl-b d om te detachen zonder de sessie te stoppen)"
echo "Was de Remote Control-koppeling verlopen? Draai in claude opnieuw: /remote-control"
docker exec -it "$CONTAINER" tmux attach -t work
