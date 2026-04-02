const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getDb } = require('../db/database');
const { authenticateWithLdap, mapLdapGroupsToService } = require('../services/ldapService');
const authLogger = require('../services/authLogger');

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function issueLocalToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function login(req, res) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  const { username, password } = result.data;
  const ip = getIp(req);
  authLogger.loginAttempt('local', username, ip);

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    authLogger.loginFailure('local', username, 'Identifiants incorrects', ip);
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // La connexion locale est réservée au compte admin local (sans ldap_dn)
  if (user.role !== 'admin' || user.ldap_dn) {
    authLogger.loginFailure('local', username, 'Compte non autorisé pour la connexion locale', ip);
    return res.status(403).json({ error: 'La connexion locale est réservée au compte administrateur local' });
  }

  authLogger.loginSuccess('local', user.username, user.id, ip);
  const token = issueLocalToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      pole: user.pole,
      service: user.service || user.pole || 'dev',
    },
  });
}

async function ldapLogin(req, res) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  const { username, password } = result.data;
  const ip = getIp(req);
  authLogger.loginAttempt('ldap', username, ip);

  // Phase 1 : authentification LDAP (peut lever une erreur réseau ou d'identifiants)
  let ldapUser;
  try {
    ldapUser = await authenticateWithLdap(username, password);
  } catch (err) {
    console.error('LDAP auth error:', err.message);
    if (err.message === 'LDAP non configuré sur le serveur') {
      authLogger.loginError('ldap', username, 'LDAP non configuré', ip);
      return res.status(503).json({ error: 'Authentification LDAP non disponible' });
    }
    const isServerError = err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')
      || err.message.includes('délai') || err.message.includes('introuvable')
      || err.message.includes('certificat') || err.message.includes('STARTTLS');
    if (isServerError) {
      authLogger.loginError('ldap', username, err.message, ip);
      return res.status(503).json({ error: err.message });
    }
    authLogger.loginFailure('ldap', username, err.message, ip);
    return res.status(401).json({ error: 'Identifiants invalides ou accès refusé' });
  }

  // Phase 2 : mise à jour / création en base (erreur interne si échec)
  try {
    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE ldap_dn = ?').get(ldapUser.dn)
              || db.prepare('SELECT * FROM users WHERE username = ?').get(ldapUser.username)
              || (ldapUser.email ? db.prepare('SELECT * FROM users WHERE email = ?').get(ldapUser.email) : null);

    if (user) {
      // Utilisateur déjà connu : on ne touche PAS au service/rôle/pole définis lors de l'import.
      // On synchronise uniquement ldap_dn (cas où trouvé par username/email) et email.
      db.prepare('UPDATE users SET ldap_dn = ?, email = ? WHERE id = ?')
        .run(ldapUser.dn, ldapUser.email || user.email, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      // Première connexion sans import préalable : créer avec mapping AD
      const { service, role } = mapLdapGroupsToService(ldapUser.groups);
      const pole = service === 'network' ? 'network' : 'dev';
      const fakeHash = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 8);
      let safeUsername = ldapUser.username.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
      let suffix = 1;
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(safeUsername)) {
        safeUsername = `${ldapUser.username.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 46)}_${suffix++}`;
      }
      const safeEmail = ldapUser.email || `${safeUsername}@ldap.local`;
      const info = db.prepare(`
        INSERT INTO users (username, email, password, role, pole, service, ldap_dn)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(safeUsername, safeEmail, fakeHash, role, pole, service, ldapUser.dn);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    authLogger.loginSuccess('ldap', user.username, user.id, ip);
    const token = issueLocalToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        pole: user.pole,
        service: user.service || 'dev',
        ldap_dn: user.ldap_dn || null,
      },
    });
  } catch (err) {
    console.error('LDAP login DB error:', err.message);
    authLogger.loginError('ldap', username, err.message, ip);
    return res.status(500).json({ error: `Erreur interne lors de la connexion : ${err.message}` });
  }
}

function logout(req, res) {
  authLogger.logout(req.user?.id, req.user?.username, getIp(req));
  res.json({ message: 'Déconnecté' });
}

function me(req, res) {
  res.json({
    ...req.user,
    service: req.user.service || req.user.pole || 'dev',
  });
}

module.exports = { login, ldapLogin, logout, me };
