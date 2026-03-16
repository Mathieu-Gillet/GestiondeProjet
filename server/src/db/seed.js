require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/tracker.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const adminUser = process.env.SEED_ADMIN_USER || 'admin';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme';
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, role, pole)
  VALUES (?, ?, ?, ?, ?)
`);

insertUser.run(adminUser, adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin', null);
insertUser.run('lead_dev', 'lead.dev@example.com', bcrypt.hashSync('password', 10), 'lead', 'dev');
insertUser.run('lead_reseau', 'lead.reseau@example.com', bcrypt.hashSync('password', 10), 'lead', 'network');
insertUser.run('alice', 'alice@example.com', bcrypt.hashSync('password', 10), 'member', 'dev');
insertUser.run('bob', 'bob@example.com', bcrypt.hashSync('password', 10), 'member', 'network');

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`);
insertTag.run('urgent', '#EF4444');
insertTag.run('bug', '#F97316');
insertTag.run('feature', '#3B82F6');
insertTag.run('infra', '#8B5CF6');
insertTag.run('sécurité', '#EC4899');

const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser).id;
const leadDevId = db.prepare('SELECT id FROM users WHERE username = ?').get('lead_dev').id;
const leadReseauId = db.prepare('SELECT id FROM users WHERE username = ?').get('lead_reseau').id;

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (title, description, pole, owner_id, status, priority, position, start_date, due_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertProject.run('Refonte du portail intranet',       'Modernisation de l\'interface avec React',              'dev',     leadDevId,    'in_progress', 'high',     0, '2026-01-15', '2026-04-30');
insertProject.run('Migration base de données',         'Passage de MySQL 5.7 vers PostgreSQL 16',              'dev',     leadDevId,    'backlog',     'critical', 0, '2026-03-01', '2026-05-31');
insertProject.run('API REST clients',                  'Création de l\'API pour l\'application mobile',        'dev',     leadDevId,    'backlog',     'normal',   1, '2026-05-01', '2026-08-15');
insertProject.run('Upgrade switches cœur de réseau',  'Remplacement des Cisco Catalyst 3750',                 'network', leadReseauId, 'in_progress', 'critical', 0, '2026-02-01', '2026-06-30');
insertProject.run('Segmentation VLAN',                 'Mise en place de la segmentation réseau par département', 'network', leadReseauId, 'backlog',  'high',     0, '2026-04-01', '2026-07-31');
insertProject.run('Plan de reprise d\'activité',       'Documentation et tests du PRA',                        'network', leadReseauId, 'on_hold',    'normal',   0, '2026-06-01', '2026-10-31');

console.log('✅ Données de démo insérées');
console.log(`   Admin : ${adminUser} / ${adminPassword}`);
console.log('   Autres comptes (mot de passe : password) : lead_dev, lead_reseau, alice, bob');
