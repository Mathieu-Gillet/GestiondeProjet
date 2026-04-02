#!/bin/sh
set -e

echo "──────────────────────────────────────"
echo "  IT Project Tracker — démarrage"
echo "──────────────────────────────────────"

DB_FILE="${DB_PATH:-/app/data/tracker.db}"
DATA_DIR="$(dirname "$DB_FILE")"

# ── Correction des permissions du volume (exécuté en root) ────────────────────
# Le montage Docker écrase le chown du Dockerfile ; on le réapplique ici.
mkdir -p "$DATA_DIR"
chown -R appuser:appgroup "$DATA_DIR"

LOG_DIR="${LOG_DIR:-/app/logs}"
mkdir -p "$LOG_DIR"
chown appuser:appgroup "$LOG_DIR" 2>/dev/null || true

# ── Initialisation ou migration de la base (exécuté en tant qu'appuser) ───────
if [ ! -f "$DB_FILE" ]; then
  echo "🗄️  Première initialisation de la base de données..."
  su-exec appuser node --experimental-sqlite src/db/init.js
  echo "🌱 Chargement des données de démonstration..."
  su-exec appuser node --experimental-sqlite src/db/seed.js
  echo "✅ Base de données initialisée"
else
  echo "🔄 Application des migrations..."
  su-exec appuser node --experimental-sqlite src/db/migrate.js
  echo "✅ Migrations terminées"
fi

echo "🚀 Démarrage du serveur sur le port ${PORT:-3000}..."
exec su-exec appuser node --experimental-sqlite src/app.js
