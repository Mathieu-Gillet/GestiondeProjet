// ldapts is ESM-only (v4+). We load it with dynamic import() from this CJS module.

// Escape special characters in LDAP filter values (RFC 4515)
function escapeFilter(str) {
  return String(str)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

async function authenticateWithLdap(username, password) {
  if (!process.env.LDAP_URL || !process.env.LDAP_BIND_DN || !process.env.LDAP_BASE_DN) {
    throw new Error('LDAP non configuré sur le serveur');
  }

  const { Client } = await import('ldapts');

  const tlsOptions =
    process.env.LDAP_TLS_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : {};

  const client = new Client({
    url: process.env.LDAP_URL,
    tlsOptions,
    timeout: 5000,
    connectTimeout: 5000,
  });

  try {
    // 1. Bind avec le compte de service pour chercher l'utilisateur
    await client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD || '');

    // 2. Rechercher le DN de l'utilisateur
    const filterTemplate = process.env.LDAP_USER_SEARCH_FILTER || '(sAMAccountName={{username}})';
    const filter = filterTemplate.replace('{{username}}', escapeFilter(username));
    const searchBase = process.env.LDAP_USER_SEARCH_BASE || process.env.LDAP_BASE_DN;

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
  const groupMap = {};
  if (process.env.LDAP_GROUP_DEV)     groupMap[process.env.LDAP_GROUP_DEV]     = { service: 'dev' };
  if (process.env.LDAP_GROUP_NETWORK) groupMap[process.env.LDAP_GROUP_NETWORK] = { service: 'network' };
  if (process.env.LDAP_GROUP_RH)      groupMap[process.env.LDAP_GROUP_RH]      = { service: 'rh' };
  if (process.env.LDAP_GROUP_DG)      groupMap[process.env.LDAP_GROUP_DG]      = { service: 'direction_generale' };
  if (process.env.LDAP_GROUP_TECH)    groupMap[process.env.LDAP_GROUP_TECH]    = { service: 'services_techniques' };
  if (process.env.LDAP_GROUP_ACHATS)  groupMap[process.env.LDAP_GROUP_ACHATS]  = { service: 'achats' };
  if (process.env.LDAP_GROUP_ADMIN)   groupMap[process.env.LDAP_GROUP_ADMIN]   = { service: 'dev', role: 'admin' };

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

module.exports = { authenticateWithLdap, mapLdapGroupsToService };
