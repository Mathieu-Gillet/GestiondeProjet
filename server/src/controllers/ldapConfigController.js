const { z } = require('zod');
const { getDb } = require('../db/database');
const { testLdapConnection } = require('../services/ldapService');

const ldapConfigSchema = z.object({
  enabled:                 z.boolean(),
  url:                     z.string().max(500).optional().nullable(),
  base_dn:                 z.string().max(500).optional().nullable(),
  bind_dn:                 z.string().max(500).optional().nullable(),
  bind_password:           z.string().max(500).optional().nullable(),
  user_search_base:        z.string().max(500).optional().nullable(),
  user_search_filter:      z.string().max(500).optional().nullable(),
  tls_reject_unauthorized: z.boolean().optional(),
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

  // Ne pas renvoyer le mot de passe en clair, masquer avec un placeholder
  res.json({
    ...row,
    enabled: row.enabled === 1,
    tls_reject_unauthorized: row.tls_reject_unauthorized === 1,
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

  // Conserver l'ancien mot de passe si le client renvoie le placeholder
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

module.exports = { getConfig, saveConfig, testConfig };
