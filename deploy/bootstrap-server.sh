#!/usr/bin/env bash
# One-time server setup for Ubuntu 24.04 (Tencent Cloud VPS).
# Usage: curl -fsSL ... | bash   OR   bash deploy/bootstrap-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/atoms-demo}"
APP_USER="${APP_USER:-$USER}"
REPO_URL="${REPO_URL:-}"

if [[ $EUID -eq 0 ]]; then
  echo "Run as a normal user (with sudo), not root."
  exit 1
fi

if [[ -z "$REPO_URL" ]]; then
  echo "Set REPO_URL, e.g.:"
  echo "  REPO_URL=git@github.com:you/atoms-demo.git bash deploy/bootstrap-server.sh"
  exit 1
fi

echo "==> System packages"
sudo apt update
sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx \
  python3 python3-pip python3-venv postgresql postgresql-contrib

echo "==> Node.js 20 + pnpm"
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
sudo npm install -g pnpm

echo "==> PostgreSQL database"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='atoms'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER atoms WITH PASSWORD 'change-me-strong-password';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='atoms_demo'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE atoms_demo OWNER atoms;"

echo "==> Clone application"
sudo mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo git clone "$REPO_URL" "$APP_DIR"
  sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit JWT_SECRET and URLs before going live."
fi
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env — edit DATABASE_URL, JWT_SECRET, CORS_ORIGINS, ENV=production."
fi

echo "==> Install dependencies (first deploy)"
pnpm install --frozen-lockfile
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e . && cd "$APP_DIR"

echo "==> systemd units"
sudo sed "s|__APP_DIR__|$APP_DIR|g; s|__APP_USER__|$APP_USER|g" \
  deploy/systemd/atoms-backend.service | sudo tee /etc/systemd/system/atoms-backend.service >/dev/null
sudo sed "s|__APP_DIR__|$APP_DIR|g; s|__APP_USER__|$APP_USER|g" \
  deploy/systemd/atoms-frontend.service | sudo tee /etc/systemd/system/atoms-frontend.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable atoms-backend atoms-frontend

echo "==> Passwordless restart for deploy user (optional)"
SUDOERS="/etc/sudoers.d/atoms-deploy"
if [[ ! -f "$SUDOERS" ]]; then
  echo "$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart atoms-backend, /bin/systemctl restart atoms-frontend, /bin/systemctl status atoms-backend, /bin/systemctl status atoms-frontend" | \
    sudo tee "$SUDOERS" >/dev/null
  sudo chmod 440 "$SUDOERS"
fi

echo ""
echo "Bootstrap done. Next steps:"
echo "  1. Edit $APP_DIR/.env and $APP_DIR/backend/.env (ENV=production, JWT_SECRET, domains)"
echo "  2. Configure Nginx: deploy/nginx/atoms-demo.conf.example → /etc/nginx/sites-available/"
echo "  3. certbot --nginx -d yourdomain.com -d api.yourdomain.com"
echo "  4. bash deploy/deploy.sh && sudo systemctl status atoms-backend atoms-frontend"
