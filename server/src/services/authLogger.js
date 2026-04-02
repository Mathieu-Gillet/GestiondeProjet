const fs = require('fs');
const path = require('path');

const LOG_DIR  = process.env.LOG_DIR  || './logs';
const LOG_FILE = path.join(LOG_DIR, 'auth.log');
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo — rotation au-delà

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotatIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size >= MAX_SIZE) {
      const rotated = LOG_FILE + '.' + new Date().toISOString().slice(0, 10);
      fs.renameSync(LOG_FILE, rotated);
    }
  } catch (_) { /* fichier inexistant, pas besoin de rotation */ }
}

function write(level, event, details) {
  try {
    ensureLogDir();
    rotatIfNeeded();

    const line = JSON.stringify({
      ts:    new Date().toISOString(),
      level,
      event,
      ...details,
    }) + '\n';

    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (err) {
    // Ne jamais faire crasher le serveur pour un problème de log
    console.error('[authLogger] Impossible d\'écrire dans le fichier de logs :', err.message);
  }
}

module.exports = {
  /** Tentative de connexion reçue */
  loginAttempt: (method, username, ip) =>
    write('INFO', 'LOGIN_ATTEMPT', { method, username, ip }),

  /** Connexion réussie */
  loginSuccess: (method, username, userId, ip) =>
    write('INFO', 'LOGIN_SUCCESS', { method, username, userId, ip }),

  /** Échec d'authentification (mauvais identifiants) */
  loginFailure: (method, username, reason, ip) =>
    write('WARN', 'LOGIN_FAILURE', { method, username, reason, ip }),

  /** Erreur interne pendant la connexion */
  loginError: (method, username, error, ip) =>
    write('ERROR', 'LOGIN_ERROR', { method, username, error, ip }),

  /** Déconnexion */
  logout: (userId, username, ip) =>
    write('INFO', 'LOGOUT', { userId, username, ip }),
};
