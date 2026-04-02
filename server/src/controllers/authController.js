const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getDb } = require('../db/database');
const { authenticateWithLdap, mapLdapGroupsToService } = require('../services/ldapService');

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
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // La connexion locale est réservée au compte admin local (sans ldap_dn)
  if (user.role !== 'admin' || user.ldap_dn) {
    return res.status(403).json({ error: 'La connexion locale est réservée au compte administrateur local' });
  }

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

  // Phase 1 : authentification LDAP (peut lever une erreur réseau ou d'identifiants)
  let ldapUser;
  try {
    ldapUser = await authenticateWithLdap(username, password);
  } catch (err) {
    console.error('LDAP auth error:', err.message);
    if (err.message === 'LDAP non configuré sur le serveur') {
      return res.status(503).json({ error: 'Authentification LDAP non disponible' });
    }
    const isServerError = err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')
      || err.message.includes('délai') || err.message.includes('introuvable')
      || err.message.includes('certificat') || err.message.includes('STARTTLS');
    if (isServerError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(401).json({ error: 'Identifiants invalides ou accès refusé' });
  }

  // Phase 2 : mise à jour / création en base (erreur interne si échec)
  try {
    const { service, role } = mapLdapGroupsToService(ldapUser.groups);
    const pole = service === 'network' ? 'network' : 'dev';

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE ldap_dn = ?').get(ldapUser.dn)
              || db.prepare('SELECT * FROM users WHERE username = ?').get(ldapUser.username)
              || (ldapUser.email ? db.prepare('SELECT * FROM users WHERE email = ?').get(ldapUser.email) : null);

    if (user) {
      db.prepare('UPDATE users SET service = ?, pole = ?, ldap_dn = ? WHERE id = ?')
        .run(service, pole, ldapUser.dn, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      const fakeHash = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 8);
      let safeUsername = ldapUser.username.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
      // Résoudre les conflits de username
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
    return res.status(500).json({ error: `Erreur interne lors de la connexion : ${err.message}` });
  }
}

function logout(req, res) {
  res.json({ message: 'Déconnecté' });
}

function me(req, res) {
  res.json({
    ...req.user,
    service: req.user.service || req.user.pole || 'dev',
  });
}

module.exports = { login, ldapLogin, logout, me };
