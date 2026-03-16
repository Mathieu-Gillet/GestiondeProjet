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

// Migration : ajout des colonnes tâches (idempotent)
const taskMigrations = [
  'ALTER TABLE tasks ADD COLUMN start_date DATE',
  'ALTER TABLE tasks ADD COLUMN due_date DATE',
  'ALTER TABLE tasks ADD COLUMN depends_on INTEGER REFERENCES tasks(id) ON DELETE SET NULL',
  'ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL',
];
for (const sql of taskMigrations) {
  try { db.exec(sql); } catch (_) { /* colonne déjà présente */ }
}

// Tables cartographie de flux métiers
db.exec(`
  CREATE TABLE IF NOT EXISTS flow_diagrams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    pole        TEXT DEFAULT 'all' CHECK(pole IN ('dev', 'network', 'all')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS flow_nodes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    diagram_id  INTEGER NOT NULL REFERENCES flow_diagrams(id) ON DELETE CASCADE,
    node_id     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'process',
    label       TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    color       TEXT DEFAULT '#6B7280',
    pos_x       REAL DEFAULT 0,
    pos_y       REAL DEFAULT 0,
    width       REAL DEFAULT 160,
    height      REAL DEFAULT 60,
    metadata    TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS flow_edges (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    diagram_id    INTEGER NOT NULL REFERENCES flow_diagrams(id) ON DELETE CASCADE,
    edge_id       TEXT NOT NULL,
    source_node   TEXT NOT NULL,
    target_node   TEXT NOT NULL,
    source_handle TEXT DEFAULT '',
    target_handle TEXT DEFAULT '',
    label         TEXT DEFAULT '',
    edge_type     TEXT DEFAULT 'smoothstep',
    animated      INTEGER DEFAULT 0,
    dashed        INTEGER DEFAULT 0
  );

  CREATE TRIGGER IF NOT EXISTS flow_diagrams_updated_at
    AFTER UPDATE ON flow_diagrams
    FOR EACH ROW
    BEGIN
      UPDATE flow_diagrams SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
`);

console.log(`✅ Base de données initialisée : ${dbPath}`);
