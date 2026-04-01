// ldapts is ESM-only (v4+). We load it with dynamic import() from this CJS module.
const { getDb } = require('../db/database');

// Escape special characters in LDAP filter values (RFC 4515)
function escapeFilter(str) {
  return String(str)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

// Lire la configuration LDAP depuis la base de données
function getLdapConfig() {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM ldap_config WHERE id = 1').get();
    if (row && row.enabled && row.url && row.bind_dn && row.base_dn) {
      return row;
    }
  } catch (_) { /* table pas encore créée */ }
  return null;
}

async function authenticateWithLdap(username, password) {
  const cfg = getLdapConfig();

  if (!cfg) {
    throw new Error('LDAP non configuré sur le serveur');
  }

  const { Client } = await import('ldapts');

  const tlsOptions = cfg.tls_reject_unauthorized === 0
    ? { rejectUnauthorized: false }
    : {};

  const client = new Client({
    url: cfg.url,
    tlsOptions,
    timeout: 5000,
    connectTimeout: 5000,
  });

  try {
    // 1. Bind avec le compte de service pour chercher l'utilisateur
    await client.bind(cfg.bind_dn, cfg.bind_password || '');

    // 2. Rechercher le DN de l'utilisateur
    const filterTemplate = cfg.user_search_filter || '(sAMAccountName={{username}})';
    const filter = filterTemplate.replace('{{username}}', escapeFilter(username));
    const searchBase = cfg.user_search_base || cfg.base_dn;

    const { searchEntries } = await client.search(searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'mail', 'displayName', 'memberOf', 'sAMAccountName', 'cn'],
    });

    if (searchEntries.length === 0) {
      throw new Error("Utilisateur non trouvé dans l'annuaire");
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // 3. Bind avec les credentials de l'utilisateur (vérification du mot de passe)
    await client.bind(userDn, password);

    // 4. Normaliser le champ memberOf en tableau
    let groups = userEntry.memberOf || [];
    if (!Array.isArray(groups)) groups = [groups];

    return {
      dn: userDn,
      username: userEntry.sAMAccountName || userEntry.cn || username,
      email: userEntry.mail || '',
      displayName: userEntry.displayName || userEntry.cn || username,
      groups,
    };
  } finally {
    await client.unbind();
  }
}

function mapLdapGroupsToService(groups) {
  const cfg = getLdapConfig();
  const groupMap = {};

  if (cfg) {
    if (cfg.group_dev)     groupMap[cfg.group_dev]     = { service: 'dev' };
    if (cfg.group_network) groupMap[cfg.group_network] = { service: 'network' };
    if (cfg.group_rh)      groupMap[cfg.group_rh]      = { service: 'rh' };
    if (cfg.group_dg)      groupMap[cfg.group_dg]      = { service: 'direction_generale' };
    if (cfg.group_tech)    groupMap[cfg.group_tech]    = { service: 'services_techniques' };
    if (cfg.group_achats)  groupMap[cfg.group_achats]  = { service: 'achats' };
    if (cfg.group_admin)   groupMap[cfg.group_admin]   = { service: 'dev', role: 'admin' };
  }

  let service = 'dev';
  let role = 'member';

  for (const groupDn of groups) {
    if (groupMap[groupDn]) {
      service = groupMap[groupDn].service || service;
      if (groupMap[groupDn].role) role = groupMap[groupDn].role;
    }
  }

  return { service, role };
}

// Tester la connexion LDAP avec une config donnée (sans modifier la DB)
async function testLdapConnection(cfg) {
  if (!cfg.url || !cfg.bind_dn || !cfg.base_dn) {
    throw new Error('Paramètres LDAP incomplets (url, bind_dn, base_dn requis)');
  }

  const { Client } = await import('ldapts');

  const tlsOptions = cfg.tls_reject_unauthorized === false || cfg.tls_reject_unauthorized === 0
    ? { rejectUnauthorized: false }
    : {};

  const client = new Client({
    url: cfg.url,
    tlsOptions,
    timeout: 5000,
    connectTimeout: 5000,
  });

  try {
    await client.bind(cfg.bind_dn, cfg.bind_password || '');
    return { success: true, message: 'Connexion LDAP réussie' };
  } finally {
    await client.unbind();
  }
}

module.exports = { authenticateWithLdap, mapLdapGroupsToService, testLdapConnection, getLdapConfig };
