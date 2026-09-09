#!/bin/bash
set -e

# Verwachte env vars (zie .env.claude-agent.example):
#   REPO_URL            - git@github.com:<org>/homeplatform.git
#   BRANCH              - standaard develop (zie feedback_git_workflow_develop_first)
#   GIT_USER_NAME
#   GIT_USER_EMAIL
#   CLAUDE_CODE_OAUTH_TOKEN - long-lived token uit `claude setup-token`

BRANCH="${BRANCH:-develop}"

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

# Persistente tmux-sessie. Zonder INITIAL_PROMPT: lege shell, zelf `claude`
# starten na attach zodat de pairing-code (Remote Control) live zichtbaar is.
# Met INITIAL_PROMPT (bv. vanuit een MindBox-commando): claude start meteen
# met die prompt - nog steeds de interactieve REPL, dus Remote Control-
# pairing werkt hetzelfde, alleen is de sessie al aan het werk bij attach.
if [ -n "$INITIAL_PROMPT" ]; then
    tmux new-session -d -s work -c /workspace "claude \"\$INITIAL_PROMPT\"" 2>/dev/null || true
else
    tmux new-session -d -s work -c /workspace 2>/dev/null || true
fi

# Container in leven houden
tail -f /dev/null
