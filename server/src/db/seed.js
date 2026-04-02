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

const adminUser     = process.env.SEED_ADMIN_USER     || 'admin';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme';
const adminEmail    = process.env.SEED_ADMIN_EMAIL    || 'admin@example.com';

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, role, pole, service)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Compte admin local
insertUser.run(adminUser, adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin', null, 'dev');

// Direction Générale — tous droits sur tous les services
insertUser.run('dir_general', 'dg@example.com', bcrypt.hashSync('password', 10), 'directeur', 'dev', 'direction_generale');

// Directeurs de service — tous droits sur leur service (y compris suppression)
insertUser.run('dir_dev',     'dir.dev@example.com',     bcrypt.hashSync('password', 10), 'directeur', 'dev',     'dev');
insertUser.run('dir_reseau',  'dir.reseau@example.com',  bcrypt.hashSync('password', 10), 'directeur', 'network', 'network');

// Responsables — créer/modifier dans leur service, pas de suppression
insertUser.run('resp_dev',    'resp.dev@example.com',    bcrypt.hashSync('password', 10), 'responsable', 'dev',     'dev');
insertUser.run('resp_reseau', 'resp.reseau@example.com', bcrypt.hashSync('password', 10), 'responsable', 'network', 'network');

// Membres — lecture + tâches assignées
insertUser.run('alice', 'alice@example.com', bcrypt.hashSync('password', 10), 'membre', 'dev',     'dev');
insertUser.run('bob',   'bob@example.com',   bcrypt.hashSync('password', 10), 'membre', 'network', 'network');

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`);
insertTag.run('urgent', '#EF4444');
insertTag.run('bug', '#F97316');
insertTag.run('feature', '#3B82F6');
insertTag.run('infra', '#8B5CF6');
insertTag.run('sécurité', '#EC4899');

const dirDevId    = db.prepare('SELECT id FROM users WHERE username = ?').get('dir_dev')?.id;
const dirReseauId = db.prepare('SELECT id FROM users WHERE username = ?').get('dir_reseau')?.id;

if (dirDevId && dirReseauId) {
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (title, description, pole, service, owner_id, status, priority, position, start_date, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProject.run('Refonte du portail intranet',      'Modernisation de l\'interface avec React',                 'dev',     dirDevId,    'in_progress', 'high',     0, '2026-01-15', '2026-04-30');
  insertProject.run('Migration base de données',        'Passage de MySQL 5.7 vers PostgreSQL 16',                  'dev',     dirDevId,    'backlog',     'critical', 0, '2026-03-01', '2026-05-31');
  insertProject.run('API REST clients',                 'Création de l\'API pour l\'application mobile',            'dev',     dirDevId,    'backlog',     'normal',   1, '2026-05-01', '2026-08-15');
  insertProject.run('Upgrade switches cœur de réseau', 'Remplacement des Cisco Catalyst 3750',                     'network', dirReseauId, 'in_progress', 'critical', 0, '2026-02-01', '2026-06-30');
  insertProject.run('Segmentation VLAN',                'Mise en place de la segmentation réseau par département',  'network', dirReseauId, 'backlog',     'high',     0, '2026-04-01', '2026-07-31');
  insertProject.run('Plan de reprise d\'activité',      'Documentation et tests du PRA',                            'network', dirReseauId, 'on_hold',     'normal',   0, '2026-06-01', '2026-10-31');
}

console.log('✅ Données de démo insérées');
console.log(`   Admin local : ${adminUser} / ${adminPassword}`);
console.log('   Direction Générale : dir_general / password (tous droits, tous services)');
console.log('   Directeurs (tous droits sur leur service) : dir_dev, dir_reseau / password');
console.log('   Responsables (créer/modifier, pas supprimer) : resp_dev, resp_reseau / password');
console.log('   Membres (lecture + tâches) : alice, bob / password');
