// ldapts is ESM-only (v4+). We load it with dynamic import() from this CJS module.
const { getDb } = require('../db/database');

// Traduit les erreurs réseau bas niveau en messages compréhensibles
function translateLdapError(err) {
  const msg = err.message || '';

  // Codes d'erreur Active Directory (champ "data XXXX" dans le message)
  const adCodeMatch = msg.match(/data\s+([0-9a-fA-F]+)/i);
  if (adCodeMatch) {
    const code = adCodeMatch[1].toLowerCase();
    const adCodes = {
      '52e': 'Mot de passe incorrect.',
      '525': 'Utilisateur introuvable dans l\'annuaire Active Directory.',
      '530': 'Connexion non autorisée à cette heure (restriction horaire AD).',
      '531': 'Connexion non autorisée depuis ce poste (restriction AD).',
      '532': 'Mot de passe expiré — l\'utilisateur doit le changer.',
      '533': 'Compte désactivé dans Active Directory.',
      '701': 'Compte expiré dans Active Directory.',
      '773': 'L\'utilisateur doit changer son mot de passe (première connexion).',
      '775': 'Compte verrouillé (trop de tentatives incorrectes).',
    };
    if (adCodes[code]) {
      return new Error(adCodes[code]);
    }
  }

  // Erreur générique InvalidCredentials LDAP (code 49)
  if (msg.includes('InvalidCredentials') || msg.includes('error 49') || msg.includes('Code: 0x31')) {
    return new Error('Identifiants invalides (code LDAP 49).');
  }

  if (msg.includes('ECONNRESET')) {
    return new Error(
      'Connexion réinitialisée par le serveur AD (ECONNRESET). ' +
      'Causes fréquentes : mauvais protocole/port (ldap:// sur 636 ou ldaps:// sur 389), ' +
      'ou le serveur requiert STARTTLS — activez l\'option STARTTLS dans la configuration.'
    );
  }
  if (msg.includes('ECONNREFUSED')) {
    return new Error(
      'Connexion refusée (ECONNREFUSED) : vérifiez l\'adresse et le port du serveur LDAP.'
    );
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ETIMEOUT') || msg.includes('timed out')) {
    return new Error(
      'Délai de connexion dépassé : le serveur LDAP est inaccessible ou un pare-feu bloque le port.'
    );
  }
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return new Error(
      'Nom de serveur introuvable : vérifiez l\'adresse du serveur LDAP (DNS ou IP).'
    );
  }
  if (msg.includes('certificate') || msg.includes('self signed') || msg.includes('CERT_') || msg.includes('ERR_TLS')) {
    return new Error(
      'Erreur de certificat TLS. Si vous utilisez un certificat auto-signé, ' +
      'décochez "Vérifier le certificat TLS" dans la configuration.'
    );
  }
  return err;
}

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
    // STARTTLS : montée en TLS sur une connexion ldap:// (port 389)
    if (cfg.use_starttls) {
      await client.startTLS(tlsOptions).catch((e) => { throw translateLdapError(e); });
    }

    // 1. Bind avec le compte de service pour chercher l'utilisateur
    await client.bind(cfg.bind_dn, cfg.bind_password || '').catch((e) => { throw translateLdapError(e); });

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
    await client.bind(userDn, password).catch((e) => { throw translateLdapError(e); });

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
    if (cfg.group_admin)   groupMap[cfg.group_admin]   = { service: 'dev', role: 'directeur' };
    if (cfg.group_dsi)     groupMap[cfg.group_dsi]     = { service: 'dev', role: 'dsi' };
  }

  let service = 'dev';
  let role = 'membre';

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
    if (cfg.use_starttls) {
      await client.startTLS(tlsOptions).catch((e) => { throw translateLdapError(e); });
    }
    await client.bind(cfg.bind_dn, cfg.bind_password || '').catch((e) => { throw translateLdapError(e); });
    return { success: true, message: 'Connexion LDAP réussie' };
  } finally {
    await client.unbind();
  }
}

// Rechercher des utilisateurs dans l'annuaire LDAP
async function searchLdapUsers(searchTerm, cfg) {
  if (!cfg) throw new Error('LDAP non configuré');

  const { Client } = await import('ldapts');

  const tlsOptions = cfg.tls_reject_unauthorized === false || cfg.tls_reject_unauthorized === 0
    ? { rejectUnauthorized: false }
    : {};

  const client = new Client({
    url: cfg.url,
    tlsOptions,
    timeout: 10000,
    connectTimeout: 5000,
  });

  try {
    if (cfg.use_starttls) {
      await client.startTLS(tlsOptions).catch((e) => { throw translateLdapError(e); });
    }
    await client.bind(cfg.bind_dn, cfg.bind_password || '').catch((e) => { throw translateLdapError(e); });

    const searchBase = cfg.user_search_base || cfg.base_dn;

    // Filtre : objectClass=person pour AD/LDAP, avec recherche optionnelle sur nom/email/login
    let filter;
    if (searchTerm && searchTerm.trim()) {
      const escaped = escapeFilter(searchTerm.trim());
      filter = `(&(objectClass=person)(|(sAMAccountName=*${escaped}*)(displayName=*${escaped}*)(mail=*${escaped}*)(cn=*${escaped}*)))`;
    } else {
      filter = '(objectClass=person)';
    }

    const { searchEntries } = await client.search(searchBase, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'mail', 'displayName', 'memberOf', 'sAMAccountName', 'cn', 'userAccountControl'],
      sizeLimit: 200,
    });

    return searchEntries.map((entry) => {
      let groups = entry.memberOf || [];
      if (!Array.isArray(groups)) groups = [groups];

      // Filtrer les comptes désactivés dans AD (bit 2 de userAccountControl)
      const uac = parseInt(entry.userAccountControl) || 0;
      const disabled = !!(uac & 2);

      return {
        dn: entry.dn,
        username: entry.sAMAccountName || entry.cn || '',
        email: entry.mail || '',
        displayName: entry.displayName || entry.cn || entry.sAMAccountName || '',
        groups,
        disabled,
      };
    }).filter((u) => u.username); // Exclure les entrées sans username
  } finally {
    await client.unbind();
  }
}

module.exports = { authenticateWithLdap, mapLdapGroupsToService, testLdapConnection, getLdapConfig, searchLdapUsers };
