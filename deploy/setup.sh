#!/usr/bin/env bash
# =============================================================================
# IT Project Tracker — Script d'installation LXC Proxmox
# Usage : sudo ./deploy/setup.sh
# Prérequis : Ubuntu 22.04 LTS, accès root
# =============================================================================
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
APP_DIR="/opt/tracker"
APP_USER="tracker"
NODE_PORT=3000
GITHUB_REPO="https://github.com/Matoudoux/GestiondeProjet.git"
SSL_KEY="/etc/ssl/private/tracker.key"
SSL_CERT="/etc/ssl/certs/tracker.crt"

# ─── Vérifications ────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "❌  Ce script doit être exécuté en root : sudo ./deploy/setup.sh"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       IT Project Tracker — Installation LXC          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Mise à jour système ──────────────────────────────────────────────────────
echo ">>> [1/9] Mise à jour des paquets système..."
apt-get update -y -qq
apt-get install -y -qq curl openssl nginx git rsync

# ─── Node.js 20 ───────────────────────────────────────────────────────────────
echo ">>> [2/9] Installation de Node.js 20..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "    Node.js $(node -v) — npm $(npm -v)"

# ─── PM2 ──────────────────────────────────────────────────────────────────────
echo ">>> [3/9] Installation de PM2..."
npm install -g pm2 --silent

# ─── Utilisateur applicatif ───────────────────────────────────────────────────
echo ">>> [4/9] Création de l'utilisateur système 'tracker'..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -r -s /bin/bash -m -d "$APP_DIR" "$APP_USER"
fi

# ─── Déploiement des fichiers ─────────────────────────────────────────────────
echo ">>> [5/9] Déploiement de l'application dans $APP_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$SCRIPT_DIR/server/package.json" ]]; then
  # Lancement depuis une copie locale du dépôt
  echo "    Source locale détectée : $SCRIPT_DIR"
  mkdir -p "$APP_DIR"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='client/node_modules' \
    --exclude='client/dist' \
    --exclude='server/data' \
    --exclude='server/.env' \
    "$SCRIPT_DIR/" "$APP_DIR/"
else
  # Clone depuis GitHub
  echo "    Clone depuis $GITHUB_REPO..."
  git clone --depth=1 "$GITHUB_REPO" "$APP_DIR"
fi

# ─── Variables d'environnement ────────────────────────────────────────────────
echo ">>> [6/9] Configuration des variables d'environnement..."
if [[ ! -f "$APP_DIR/server/.env" ]]; then
  cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$APP_DIR/server/.env"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$APP_DIR/server/.env"
  echo "    JWT_SECRET généré automatiquement."
else
  echo "    Fichier .env existant conservé."
fi

# ─── Dépendances + Build ──────────────────────────────────────────────────────
echo ">>> [7/9] Installation des dépendances et build du frontend..."
cd "$APP_DIR/server" && npm ci --omit=dev --silent
cd "$APP_DIR/client" && npm ci --silent
cd "$APP_DIR/client" && npm run build --silent

mkdir -p "$APP_DIR/server/public"
cp -r "$APP_DIR/client/dist/." "$APP_DIR/server/public/"

mkdir -p "$APP_DIR/server/data"
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ─── Certificat SSL auto-signé ────────────────────────────────────────────────
echo ">>> [8/9] Génération du certificat SSL auto-signé (10 ans)..."
if [[ ! -f "$SSL_CERT" ]]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_KEY" \
    -out "$SSL_CERT" \
    -subj "/C=FR/ST=Local/L=Local/O=IT-Team/CN=tracker.local" \
    2>/dev/null
  chmod 600 "$SSL_KEY"
  echo "    Certificat généré : $SSL_CERT"
else
  echo "    Certificat existant conservé."
fi

# ─── nginx ────────────────────────────────────────────────────────────────────
echo ">>> [9/9] Configuration de nginx..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/tracker
ln -sf /etc/nginx/sites-available/tracker /etc/nginx/sites-enabled/tracker
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx --quiet
systemctl restart nginx

# ─── PM2 — démarrage et persistance ──────────────────────────────────────────
cd "$APP_DIR"
sudo -u "$APP_USER" pm2 start deploy/ecosystem.config.cjs
sudo -u "$APP_USER" pm2 save

# Activation du démarrage automatique via systemd
PM2_STARTUP=$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" | grep "sudo")
if [[ -n "$PM2_STARTUP" ]]; then
  eval "$PM2_STARTUP"
fi

# ─── Récapitulatif ────────────────────────────────────────────────────────────
LXC_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅  Installation terminée avec succès !            ║"
echo "║                                                      ║"
printf "║   🌐  https://%-37s║\n" "$LXC_IP"
echo "║                                                      ║"
echo "║   ⚠️   Certificat auto-signé : accepter             ║"
echo "║        l'avertissement dans le navigateur.           ║"
echo "║                                                      ║"
echo "║   📝  Config : /opt/tracker/server/.env             ║"
echo "║   📋  Logs   : pm2 logs tracker                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
