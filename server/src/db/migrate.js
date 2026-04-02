require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/tracker.db';
if (!fs.existsSync(dbPath)) {
  console.log('Aucune base de données à migrer.');
  process.exit(0);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const migrations = [
  {
    name: 'start_date',
    sql: 'ALTER TABLE projects ADD COLUMN start_date DATE',
  },
  {
    name: 'earliest_start',
    sql: 'ALTER TABLE projects ADD COLUMN earliest_start DATE',
  },
  {
    name: 'latest_end',
    sql: 'ALTER TABLE projects ADD COLUMN latest_end DATE',
  },
  {
    name: 'tasks_table',
    sql: `CREATE TABLE IF NOT EXISTS tasks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      duration_days  INTEGER NOT NULL DEFAULT 1,
      status         TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      position       INTEGER NOT NULL DEFAULT 0,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
];

for (const m of migrations) {
  try {
    db.exec(m.sql);
    console.log(`✅ Migration : ${m.name} appliquée.`);
  } catch {
    console.log(`ℹ️  Migration ${m.name} déjà présente.`);
  }
}

// ── Colonnes service / ldap_dn (idempotentes) ─────────────────────────────────
const columnMigrations = [
  `ALTER TABLE users    ADD COLUMN service TEXT NOT NULL DEFAULT 'dev'`,
  `ALTER TABLE projects ADD COLUMN service TEXT NOT NULL DEFAULT 'dev'`,
  `ALTER TABLE users    ADD COLUMN azure_oid TEXT`,
  `ALTER TABLE users    RENAME COLUMN azure_oid TO ldap_dn`,
  `ALTER TABLE users    ADD COLUMN ldap_dn TEXT`,
];
for (const sql of columnMigrations) {
  try { db.exec(sql); } catch (_) { /* déjà présente */ }
}
try {
  db.exec(`UPDATE users    SET service = pole WHERE pole IS NOT NULL AND service = 'dev' AND pole != 'dev'`);
  db.exec(`UPDATE projects SET service = pole WHERE pole IS NOT NULL AND service = 'dev' AND pole != 'dev'`);
} catch (_) {}

// ── Table ldap_config (idempotente) ───────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ldap_config (
      id                      INTEGER PRIMARY KEY CHECK(id = 1),
      enabled                 INTEGER NOT NULL DEFAULT 0,
      url                     TEXT,
      base_dn                 TEXT,
      bind_dn                 TEXT,
      bind_password           TEXT,
      user_search_base        TEXT,
      user_search_filter      TEXT NOT NULL DEFAULT '(sAMAccountName={{username}})',
      tls_reject_unauthorized INTEGER NOT NULL DEFAULT 1,
      use_starttls            INTEGER NOT NULL DEFAULT 0,
      group_dev               TEXT,
      group_network           TEXT,
      group_rh                TEXT,
      group_dg                TEXT,
      group_tech              TEXT,
      group_achats            TEXT,
      group_admin             TEXT,
      updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`INSERT OR IGNORE INTO ldap_config (id) VALUES (1)`);
  console.log('✅ Migration : ldap_config appliquée.');
} catch (err) {
  console.log('ℹ️  Migration ldap_config :', err.message);
}
// Ajout de use_starttls sur une table ldap_config déjà existante
try {
  db.exec(`ALTER TABLE ldap_config ADD COLUMN use_starttls INTEGER NOT NULL DEFAULT 0`);
} catch (_) { /* colonne déjà présente */ }
// Ajout de group_dsi sur une table ldap_config déjà existante
try {
  db.exec(`ALTER TABLE ldap_config ADD COLUMN group_dsi TEXT`);
} catch (_) { /* colonne déjà présente */ }

// ── Migration des rôles : lead → directeur, member → membre, + ajout dsi ─────
// SQLite ne permettant pas de modifier une contrainte CHECK, on recrée la table.
// On vérifie le schéma réel plutôt que les données (sinon les bases vides sont ratées).
try {
  const schemaSql = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
  ).get()?.sql || '';

  // Migration nécessaire si : anciens rôles présents OU 'dsi' absent du schéma
  const needsMigration = schemaSql.includes("'lead'") || schemaSql.includes("'member'")
    || (!schemaSql.includes("'directeur'") && !schemaSql.includes("'membre'"))
    || !schemaSql.includes("'dsi'");

  if (needsMigration) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_v2 (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT NOT NULL UNIQUE,
        email      TEXT NOT NULL UNIQUE,
        password   TEXT NOT NULL,
        role       TEXT NOT NULL DEFAULT 'membre'
                   CHECK(role IN ('admin', 'directeur', 'responsable', 'membre', 'dsi')),
        pole       TEXT CHECK(pole IN ('dev', 'network')),
        service    TEXT NOT NULL DEFAULT 'dev',
        ldap_dn    TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      INSERT INTO users_v2 (id, username, email, password, role, pole, service, ldap_dn, created_at)
      SELECT id, username, email, password,
        CASE role
          WHEN 'lead'   THEN 'directeur'
          WHEN 'member' THEN 'membre'
          ELSE role
        END,
        pole, COALESCE(service, 'dev'), ldap_dn, created_at
      FROM users
    `);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_v2 RENAME TO users');
    db.exec('PRAGMA foreign_keys = ON');
    console.log('✅ Migration des rôles : schéma mis à jour (ajout dsi)');
  } else {
    console.log('ℹ️  Migration des rôles déjà appliquée.');
  }
} catch (err) {
  try { db.exec('PRAGMA foreign_keys = ON'); } catch (_) {}
  console.log('ℹ️  Migration des rôles :', err.message);
}

console.log('✅ Migrations terminées.');
