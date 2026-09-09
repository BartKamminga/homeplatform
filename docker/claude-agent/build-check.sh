#!/bin/bash
# Handmatig aan te roepen binnen een sessie (niet automatisch bij start -
# builds zijn zwaar en horen niet bij elke container-start).
set -e

cd /workspace/backend
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r requirements.txt
.venv/bin/pytest -q

cd /workspace/frontend/sites
npm ci
npm run build
