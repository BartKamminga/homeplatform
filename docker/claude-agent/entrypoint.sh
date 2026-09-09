#!/bin/bash
set -e

# Verwachte env vars (zie .env.claude-agent.example):
#   GIT_ENABLED         - true/false (default true) - git-clone/deploy-key (item 1134)
#   REPO_URL            - git@github.com:<org>/homeplatform.git (alleen als GIT_ENABLED=true)
#   BRANCH              - standaard develop (zie feedback_git_workflow_develop_first)
#   GIT_USER_NAME
#   GIT_USER_EMAIL
#   CLAUDE_CODE_OAUTH_TOKEN - long-lived token uit `claude setup-token`
#   INTERACTIVE         - true/false (default true) - tmux+Remote Control vs. headless claude -p (item 1134)
#   ONBOARDING_DOC      - bestandsnaam onder /opt/onboarding/ (bv. mindbox.md), alleen relevant als GIT_ENABLED=false

GIT_ENABLED="${GIT_ENABLED:-true}"
INTERACTIVE="${INTERACTIVE:-true}"
BRANCH="${BRANCH:-develop}"
SESSION_NAME="${SESSION_NAME:-devsession}"

if [ "$GIT_ENABLED" = "true" ]; then
    if [ ! -d /workspace/.git ]; then
        echo "Clonen van ${REPO_URL} (branch ${BRANCH})..."
        git clone --branch "$BRANCH" "$REPO_URL" /workspace
    else
        echo "Repo al aanwezig in /workspace, geen automatische pull (voorkomt overschrijven van lokaal werk)."
    fi
    cd /workspace
    git config --global user.name "${GIT_USER_NAME:-Claude Agent}"
    git config --global user.email "${GIT_USER_EMAIL:-bart.kamminga@nipv.nl}"
    git config --global --add safe.directory /workspace
else
    # Geen repo - dus geen eigen CLAUDE.md. Claude Code laadt CLAUDE.md in de
    # working dir automatisch als projectcontext, dus de use-case-onboarding
    # (_shared.md + het use-case-specifieke document) landt hier i.p.v. als
    # los promptbericht - geen extra beurt, geen quoting-gedoe met multi-line
    # markdown in een tmux/claude-commando.
    cd /workspace
    if [ ! -f /workspace/CLAUDE.md ]; then
        {
            [ -f /opt/onboarding/_shared.md ] && cat /opt/onboarding/_shared.md
            [ -n "$ONBOARDING_DOC" ] && [ -f "/opt/onboarding/$ONBOARDING_DOC" ] && { echo; cat "/opt/onboarding/$ONBOARDING_DOC"; }
        } > /workspace/CLAUDE.md
    fi
fi

# Persistente tmux-sessie, claude start altijd met --name (zichtbaar als
# sessienaam op claude.ai/code i.p.v. een automatisch gegenereerde naam) -
# zie ook /rename binnen de REPL om 'm later nog aan te passen. Met
# INITIAL_PROMPT (bv. vanuit een MindBox-commando) krijgt claude die meteen
# als eerste bericht mee - nog steeds de interactieve REPL, dus Remote
# Control-pairing werkt hetzelfde, alleen is de sessie al aan het werk bij
# attach. Zonder INITIAL_PROMPT doorloop je zelf nog de eerste-keer-wizard
# (thema, login, trust-folder) na attach.
if [ "$INTERACTIVE" = "true" ]; then
    if [ -n "$INITIAL_PROMPT" ]; then
        tmux new-session -d -s work -c /workspace "claude --name \"\$SESSION_NAME\" \"\$INITIAL_PROMPT\"" 2>/dev/null || true
    else
        tmux new-session -d -s work -c /workspace "claude --name \"\$SESSION_NAME\"" 2>/dev/null || true
    fi
    # Container in leven houden
    tail -f /dev/null
else
    # Headless (item 1134): geen tmux/Remote Control nodig, resultaat komt
    # via het logbestand dat de backend uitleest (zie _read_headless_log in
    # dev_sessions.py). Vereist een taak - zonder INITIAL_PROMPT is er niets
    # om headless te doen (niemand om 'm interactief te geven).
    LOG=/workspace/.claude-session.log
    if [ -z "$INITIAL_PROMPT" ]; then
        echo "Geen INITIAL_PROMPT - headless sessie heeft een taak nodig, niets te doen." > "$LOG"
        exit 1
    fi
    set +e
    claude -p "$INITIAL_PROMPT" --output-format text > "$LOG" 2>&1
    CODE=$?
    set -e
    echo "--- sessie klaar (exitcode $CODE) ---" >> "$LOG"
    exit $CODE
fi
