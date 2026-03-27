const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const jwksClient = require('jwks-rsa');
const { getDb } = require('../db/database');

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Map env var group Object IDs → service
function buildGroupServiceMap() {
  return {
    [process.env.AZURE_GROUP_DEV]:    'dev',
    [process.env.AZURE_GROUP_NETWORK]: 'network',
    [process.env.AZURE_GROUP_RH]:     'rh',
    [process.env.AZURE_GROUP_DG]:     'direction_generale',
    [process.env.AZURE_GROUP_TECH]:   'services_techniques',
    [process.env.AZURE_GROUP_ACHATS]: 'achats',
  };
}

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

async function azureLogin(req, res) {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken requis' });
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) {
    return res.status(500).json({ error: 'AZURE_TENANT_ID non configuré côté serveur' });
  }

  try {
    // Valider le token via JWKS Microsoft
    const client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 600000,
    });

    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        accessToken,
        (header, callback) => {
          client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key.getPublicKey());
          });
        },
        {
          audience: process.env.AZURE_CLIENT_ID,
          issuer: [
            `https://login.microsoftonline.com/${tenantId}/v2.0`,
            `https://sts.windows.net/${tenantId}/`,
          ],
          algorithms: ['RS256'],
        },
        (err, payload) => {
          if (err) reject(err);
          else resolve(payload);
        }
      );
    });

    const oid = decoded.oid || decoded.sub;
    const email = decoded.preferred_username || decoded.email || decoded.upn || '';
    const displayName = decoded.name || email.split('@')[0] || 'user';

    // Récupérer les groupes via Microsoft Graph
    let fetchFn;
    try { fetchFn = require('node-fetch'); } catch { fetchFn = globalThis.fetch; }

    let groupIds = [];
    const graphRes = await fetchFn('https://graph.microsoft.com/v1.0/me/memberOf?$select=id', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (graphRes.ok) {
      const graphData = await graphRes.json();
      groupIds = (graphData.value || []).map((g) => g.id).filter(Boolean);
    }

    // Mapper les groupes vers un service
    const groupMap = buildGroupServiceMap();
    let service = null;
    for (const gid of groupIds) {
      if (groupMap[gid]) { service = groupMap[gid]; break; }
    }
    if (!service) service = 'dev';

    // Rôle admin si dans le groupe admin
    const adminGroupId = process.env.AZURE_GROUP_ADMIN;
    const isAdmin = adminGroupId && groupIds.includes(adminGroupId);
    const pole = service === 'network' ? 'network' : 'dev';

    // Créer ou mettre à jour l'utilisateur
    const db = getDb();
    const username = (email.split('@')[0] || displayName).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50);

    let user = db.prepare('SELECT * FROM users WHERE azure_oid = ?').get(oid)
              || db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (user) {
      db.prepare(`UPDATE users SET service = ?, azure_oid = ?, pole = ? WHERE id = ?`)
        .run(service, oid, pole, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      const fakeHash = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 8);
      const role = isAdmin ? 'admin' : 'member';
      const info = db.prepare(`
        INSERT INTO users (username, email, password, role, pole, service, azure_oid)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(username, email, fakeHash, role, pole, service, oid);
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
      },
    });
  } catch (err) {
    console.error('Azure login error:', err.message);
    return res.status(401).json({ error: 'Token Azure invalide ou expiré' });
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

module.exports = { login, azureLogin, logout, me };
