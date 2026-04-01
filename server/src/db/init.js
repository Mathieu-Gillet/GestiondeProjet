require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/tracker.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'lead', 'member')),
    pole        TEXT CHECK(pole IN ('dev', 'network')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    pole            TEXT NOT NULL CHECK(pole IN ('dev', 'network')),
    owner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'in_progress', 'on_hold', 'done')),
    priority        TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('critical', 'high', 'normal', 'low')),
    position        INTEGER NOT NULL DEFAULT 0,
    start_date      DATE,
    due_date        DATE,
    earliest_start  DATE,
    latest_end      DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280'
  );

  CREATE TABLE IF NOT EXISTS project_tags (
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    tag_id      INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    detail      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    duration_days  INTEGER NOT NULL DEFAULT 1,
    duration_hours INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS projects_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    BEGIN
      UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
`);

// Table notifications
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id    INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    from_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type          TEXT NOT NULL DEFAULT 'task_status_changed',
    message       TEXT NOT NULL,
    read          INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration : ajout des colonnes tâches (idempotent)
// Migration : table task_date_requests (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS task_date_requests (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id            INTEGER NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
    project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by       INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    current_start_date TEXT,
    current_due_date   TEXT,
    new_start_date     TEXT,
    new_due_date       TEXT,
    reason             TEXT,
    status             TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    response_note      TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Table dépendances entre projets (Fin-à-Début)
db.exec(`
  CREATE TABLE IF NOT EXISTS project_dependencies (
    from_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    to_project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (from_project_id, to_project_id)
  );
`);

const taskMigrations = [
  'ALTER TABLE tasks ADD COLUMN start_date DATE',
  'ALTER TABLE tasks ADD COLUMN due_date DATE',
  'ALTER TABLE tasks ADD COLUMN depends_on INTEGER REFERENCES tasks(id) ON DELETE SET NULL',
  'ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL',
  'ALTER TABLE tasks ADD COLUMN notes TEXT',
  'ALTER TABLE comments ADD COLUMN task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE',
  'ALTER TABLE tasks ADD COLUMN earliest_start DATE',
  'ALTER TABLE tasks ADD COLUMN latest_end DATE',
  'ALTER TABLE tasks ADD COLUMN duration_hours INTEGER NOT NULL DEFAULT 0',
];
for (const sql of taskMigrations) {
  try { db.exec(sql); } catch (_) { /* colonne déjà présente */ }
}

// Migration : ajout de la colonne service (idempotent)
// service remplace logiquement pole avec un périmètre élargi
const serviceMigrations = [
  `ALTER TABLE users ADD COLUMN service TEXT NOT NULL DEFAULT 'dev'`,
  `ALTER TABLE projects ADD COLUMN service TEXT NOT NULL DEFAULT 'dev'`,
  `ALTER TABLE users ADD COLUMN azure_oid TEXT`,
];

// Migration : azure_oid → ldap_dn
const ldapMigrations = [
  `ALTER TABLE users RENAME COLUMN azure_oid TO ldap_dn`,
  `ALTER TABLE users ADD COLUMN ldap_dn TEXT`,
];
for (const sql of serviceMigrations) {
  try { db.exec(sql); } catch (_) { /* colonne déjà présente */ }
}
for (const sql of ldapMigrations) {
  try { db.exec(sql); } catch (_) { /* déjà migrée */ }
}
// Peupler service depuis pole pour les enregistrements existants
try {
  db.exec(`UPDATE users SET service = pole WHERE pole IS NOT NULL AND service = 'dev' AND pole != 'dev'`);
  db.exec(`UPDATE projects SET service = pole WHERE pole IS NOT NULL AND service = 'dev' AND pole != 'dev'`);
} catch (_) { /* ignore */ }


// Table de configuration LDAP (ligne unique, id=1)
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
    group_dev               TEXT,
    group_network           TEXT,
    group_rh                TEXT,
    group_dg                TEXT,
    group_tech              TEXT,
    group_achats            TEXT,
    group_admin             TEXT,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Initialiser la ligne unique si elle n'existe pas
try {
  db.exec(`INSERT OR IGNORE INTO ldap_config (id) VALUES (1)`);
} catch (_) { /* déjà présent */ }

console.log(`✅ Base de données initialisée : ${dbPath}`);
