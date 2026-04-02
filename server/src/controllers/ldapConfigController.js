const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getDb } = require('../db/database');
const { testLdapConnection, searchLdapUsers, mapLdapGroupsToService, getLdapConfig } = require('../services/ldapService');

const ldapConfigSchema = z.object({
  enabled:                 z.boolean(),
  url:                     z.string().max(500).optional().nullable(),
  base_dn:                 z.string().max(500).optional().nullable(),
  bind_dn:                 z.string().max(500).optional().nullable(),
  bind_password:           z.string().max(500).optional().nullable(),
  user_search_base:        z.string().max(500).optional().nullable(),
  user_search_filter:      z.string().max(500).optional().nullable(),
  tls_reject_unauthorized: z.boolean().optional(),
  use_starttls:            z.boolean().optional(),
  group_dev:               z.string().max(500).optional().nullable(),
  group_network:           z.string().max(500).optional().nullable(),
  group_rh:                z.string().max(500).optional().nullable(),
  group_dg:                z.string().max(500).optional().nullable(),
  group_tech:              z.string().max(500).optional().nullable(),
  group_achats:            z.string().max(500).optional().nullable(),
  group_admin:             z.string().max(500).optional().nullable(),
});

// Vérifier que l'utilisateur est un admin local (pas LDAP)
function requireLocalAdmin(req, res) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé à l\'administrateur' });
    return false;
  }
  if (req.user.ldap_dn) {
    res.status(403).json({ error: 'Cette page est réservée au compte administrateur local uniquement' });
    return false;
  }
  return true;
}

function getConfig(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  const db = getDb();
  const row = db.prepare('SELECT * FROM ldap_config WHERE id = 1').get();
  if (!row) {
    return res.json({
      enabled: false,
      url: '', base_dn: '', bind_dn: '', bind_password: '',
      user_search_base: '', user_search_filter: '(sAMAccountName={{username}})',
      tls_reject_unauthorized: true,
      group_dev: '', group_network: '', group_rh: '',
      group_dg: '', group_tech: '', group_achats: '', group_admin: '',
    });
  }

  res.json({
    ...row,
    enabled: row.enabled === 1,
    tls_reject_unauthorized: row.tls_reject_unauthorized === 1,
    use_starttls: row.use_starttls === 1,
    bind_password: row.bind_password ? '••••••••' : '',
    _has_password: !!row.bind_password,
  });
}

function saveConfig(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  const result = ldapConfigSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.issues });
  }

  const data = result.data;
  const db = getDb();
  const existing = db.prepare('SELECT bind_password FROM ldap_config WHERE id = 1').get();

  const bindPassword = (data.bind_password === '••••••••' || data.bind_password === null)
    ? (existing?.bind_password || null)
    : (data.bind_password || null);

  db.prepare(`
    UPDATE ldap_config SET
      enabled                 = ?,
      url                     = ?,
      base_dn                 = ?,
      bind_dn                 = ?,
      bind_password           = ?,
      user_search_base        = ?,
      user_search_filter      = ?,
      tls_reject_unauthorized = ?,
      use_starttls            = ?,
      group_dev               = ?,
      group_network           = ?,
      group_rh                = ?,
      group_dg                = ?,
      group_tech              = ?,
      group_achats            = ?,
      group_admin             = ?,
      updated_at              = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    data.enabled ? 1 : 0,
    data.url || null,
    data.base_dn || null,
    data.bind_dn || null,
    bindPassword,
    data.user_search_base || null,
    data.user_search_filter || '(sAMAccountName={{username}})',
    data.tls_reject_unauthorized !== false ? 1 : 0,
    data.use_starttls ? 1 : 0,
    data.group_dev || null,
    data.group_network || null,
    data.group_rh || null,
    data.group_dg || null,
    data.group_tech || null,
    data.group_achats || null,
    data.group_admin || null,
  );

  res.json({ message: 'Configuration LDAP sauvegardée' });
}

async function testConfig(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  const result = ldapConfigSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const data = result.data;
  const db = getDb();
  const existing = db.prepare('SELECT bind_password FROM ldap_config WHERE id = 1').get();

  const bindPassword = (data.bind_password === '••••••••' || data.bind_password === null)
    ? (existing?.bind_password || '')
    : (data.bind_password || '');

  try {
    const result = await testLdapConnection({
      url: data.url,
      base_dn: data.base_dn,
      bind_dn: data.bind_dn,
      bind_password: bindPassword,
      tls_reject_unauthorized: data.tls_reject_unauthorized !== false ? 1 : 0,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// Rechercher des utilisateurs dans l'annuaire LDAP
async function searchUsers(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  const cfg = getLdapConfig();
  if (!cfg) {
    return res.status(503).json({ error: 'LDAP non configuré ou désactivé. Sauvegardez et activez la configuration LDAP d\'abord.' });
  }

  const searchTerm = (req.query.q || '').toString().slice(0, 100);

  try {
    const ldapUsers = await searchLdapUsers(searchTerm, cfg);

    // Enrichir avec le statut local (déjà importé ou non)
    const db = getDb();
    const result = ldapUsers.map((u) => {
      const local = db.prepare('SELECT id, role, service FROM users WHERE ldap_dn = ? OR username = ?')
        .get(u.dn, u.username);
      const { service, role } = mapLdapGroupsToService(u.groups);
      return {
        ...u,
        mapped_service: service,
        mapped_role: role,
        local_id: local?.id || null,
        already_imported: !!local,
      };
    });

    res.json({ users: result, total: result.length });
  } catch (err) {
    console.error('LDAP search error:', err.message);
    res.status(400).json({ error: err.message });
  }
}

// Importer des utilisateurs LDAP sélectionnés dans la base locale
async function importUsers(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  // Accepte { users: [{dn, username, email, displayName, service, role}] }
  // ou le format legacy { dns: [...] }
  let usersToImport = [];
  if (Array.isArray(req.body.users) && req.body.users.length > 0) {
    usersToImport = req.body.users;
  } else if (Array.isArray(req.body.dns) && req.body.dns.length > 0) {
    usersToImport = req.body.dns.map((dn) => ({ dn }));
  } else {
    return res.status(400).json({ error: 'Aucun utilisateur sélectionné' });
  }

  if (usersToImport.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 utilisateurs par import' });
  }

  const VALID_SERVICES = ['dev', 'network', 'rh', 'direction_generale', 'services_techniques', 'achats'];
  const VALID_ROLES    = ['directeur', 'responsable', 'membre'];

  const db = getDb();
  const results = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const item of usersToImport) {
    if (!item.dn || typeof item.dn !== 'string') {
      results.errors.push({ dn: String(item.dn), error: 'DN invalide' });
      results.skipped++;
      continue;
    }

    try {
      const service  = (item.service  && VALID_SERVICES.includes(item.service))  ? item.service  : 'dev';
      const role     = (item.role     && VALID_ROLES.includes(item.role))         ? item.role     : 'membre';
      const pole     = service === 'network' ? 'network' : 'dev';
      const rawUsername = item.username ? String(item.username).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) : null;
      const email       = item.email   ? String(item.email).slice(0, 254) : null;

      if (!rawUsername) {
        results.errors.push({ dn: item.dn, error: 'Nom d\'utilisateur manquant dans les données envoyées' });
        results.skipped++;
        continue;
      }

      // Recherche d'un compte existant : priorité DN > username > email
      const existing = db.prepare('SELECT * FROM users WHERE ldap_dn = ?').get(item.dn)
        || db.prepare('SELECT * FROM users WHERE username = ?').get(rawUsername)
        || (email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null);

      if (existing) {
        // Mise à jour : on ne change PAS le username pour éviter les conflits UNIQUE
        db.prepare('UPDATE users SET service = ?, pole = ?, role = ?, ldap_dn = ?, email = ? WHERE id = ?')
          .run(service, pole, role, item.dn, email || existing.email, existing.id);
        results.updated++;
      } else {
        // Création : résoudre les conflits de username en ajoutant un suffixe si besoin
        let username = rawUsername;
        let suffix = 1;
        while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
          username = `${rawUsername}_${suffix++}`;
        }

        // Email fallback unique basé sur le DN hashé pour éviter les collisions
        const fallbackEmail = email || `${username}@ldap.local`;
        const finalEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(fallbackEmail)
          ? `${username}_${Date.now()}@ldap.local`
          : fallbackEmail;

        const fakeHash = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 8);
        db.prepare(`
          INSERT INTO users (username, email, password, role, pole, service, ldap_dn)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(username, finalEmail, fakeHash, role, pole, service, item.dn);
        results.created++;
      }
    } catch (err) {
      results.errors.push({ dn: item.dn, error: err.message });
      results.skipped++;
    }
  }

  res.json({
    message: `Import terminé : ${results.created} créé(s), ${results.updated} mis à jour, ${results.skipped} ignoré(s)`,
    ...results,
  });
}

// Lister les utilisateurs déjà importés depuis LDAP
function getImportedUsers(req, res) {
  if (!requireLocalAdmin(req, res)) return;

  const db = getDb();
  const q = (req.query.q || '').toString().trim().slice(0, 100);

  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT id, username, email, role, service, ldap_dn, created_at
      FROM users
      WHERE ldap_dn IS NOT NULL
        AND (username LIKE ? OR email LIKE ?)
      ORDER BY username
      LIMIT 200
    `).all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`
      SELECT id, username, email, role, service, ldap_dn, created_at
      FROM users
      WHERE ldap_dn IS NOT NULL
      ORDER BY username
      LIMIT 500
    `).all();
  }

  res.json({ users: rows, total: rows.length });
}

module.exports = { getConfig, saveConfig, testConfig, searchUsers, importUsers, getImportedUsers };
