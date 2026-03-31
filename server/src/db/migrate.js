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
