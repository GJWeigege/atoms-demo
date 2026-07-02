#!/usr/bin/env bash
# Run on the server after each release (manually or via GitHub Actions SSH).
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"
cd "$APP_DIR"

echo "==> Deploy atoms-demo @ $APP_DIR (branch: $BRANCH)"

if [[ ! -f .env ]] || [[ ! -f backend/.env ]]; then
  echo "ERROR: Missing .env or backend/.env — create them on the server before first deploy."
  echo "  cp .env.example .env && cp backend/.env.example backend/.env"
  exit 1
fi

echo "==> Pull latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Frontend: install & build"
pnpm install --frozen-lockfile
pnpm build

echo "==> Backend: venv & dependencies"
cd backend
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -U pip
pip install -e .
cd "$APP_DIR"

echo "==> Restart services"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart atoms-backend atoms-frontend
else
  echo "WARN: systemctl not found — start services manually."
  exit 0
fi

echo "==> Health check"
sleep 3
curl -sf "http://127.0.0.1:8000/api/health" >/dev/null
curl -sf -o /dev/null "http://127.0.0.1:3000"
echo "Deploy OK"
