#!/usr/bin/env bash
# =============================================================================
# IT Project Tracker — Script de mise à jour
# Usage : sudo ./deploy/update.sh   (depuis /opt/tracker)
# =============================================================================
set -euo pipefail

APP_DIR="/opt/tracker"
APP_USER="tracker"

if [[ $EUID -ne 0 ]]; then
  echo "❌  Ce script doit être exécuté en root : sudo ./deploy/update.sh"
  exit 1
fi

echo ""
echo "=== IT Project Tracker — Mise à jour ==="
echo ""

# ─── Pull ────────────────────────────────────────────────────────────────────
echo ">>> [1/4] Récupération des dernières modifications..."
cd "$APP_DIR"
git pull

# ─── Dépendances ─────────────────────────────────────────────────────────────
echo ">>> [2/4] Mise à jour des dépendances..."
cd "$APP_DIR/server" && npm ci --omit=dev --silent
cd "$APP_DIR/client" && npm ci --silent

# ─── Build frontend ───────────────────────────────────────────────────────────
echo ">>> [3/4] Build du frontend..."
cd "$APP_DIR/client" && npm run build --silent
mkdir -p "$APP_DIR/server/public"
cp -r "$APP_DIR/client/dist/." "$APP_DIR/server/public/"

# ─── Redémarrage ─────────────────────────────────────────────────────────────
echo ">>> [4/4] Redémarrage du serveur..."
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" pm2 restart tracker

echo ""
echo "✅  Mise à jour terminée."
sudo -u "$APP_USER" pm2 status tracker
echo ""
