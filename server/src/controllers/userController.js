const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getDb } = require('../db/database');

const VALID_SERVICES = ['dev', 'network', 'rh', 'direction_generale', 'services_techniques', 'achats'];

const createUserSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'lead', 'member']).default('member'),
  service: z.enum(VALID_SERVICES).optional().default('dev'),
  pole: z.enum(['dev', 'network']).optional().nullable(),
});

const updateUserSchema = z.object({
  username: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'lead', 'member']).optional(),
  service: z.enum(VALID_SERVICES).optional(),
  pole: z.enum(['dev', 'network']).optional().nullable(),
});

function list(req, res) {
  const db = getDb();
  const users = db.prepare('SELECT id, username, email, role, pole, service, created_at FROM users ORDER BY username').all();
  res.json(users);
}

function create(req, res) {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { username, email, password, role, service, pole } = result.data;
  const resolvedPole = pole || (service === 'network' ? 'network' : 'dev');
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (username, email, password, role, pole, service) VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, email, hash, role, resolvedPole, service || 'dev');

  const user = db.prepare('SELECT id, username, email, role, pole, service, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(user);
}

function update(req, res) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { password, ...fields } = result.data;
  const changes = [];
  const params = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      changes.push(`${key} = ?`);
      params.push(val);
    }
  }

  if (password) {
    changes.push('password = ?');
    params.push(bcrypt.hashSync(password, 10));
  }

  if (changes.length === 0) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${changes.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT id, username, email, role, pole, service, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();

  // Empêcher la suppression de son propre compte
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Utilisateur supprimé' });
}

function myProjects(req, res) {
  const db = getDb();
  try {
    const projects = db.prepare(`
      SELECT p.*,
             u.username  AS owner_username,
             u.pole      AS owner_pole
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id IN (
        SELECT project_id FROM project_members WHERE user_id = ?
      )
      ORDER BY p.updated_at DESC
    `).all(req.user.id);

    // Enrichir chaque projet avec ses tags
    const getTags = db.prepare(`
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN project_tags pt ON pt.tag_id = t.id
      WHERE pt.project_id = ?
    `);

    const result = projects.map((p) => ({
      ...p,
      tags: getTags.all(p.id),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function myTasks(req, res) {
  const db = getDb();
  try {
    const tasks = db.prepare(`
      SELECT t.*,
             p.title     AS project_title,
             p.pole      AS project_pole,
             p.status    AS project_status,
             dep.title   AS depends_on_title
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN tasks dep ON dep.id = t.depends_on
      WHERE t.assigned_to = ?
      ORDER BY
        CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
        t.due_date ASC NULLS LAST,
        p.title
    `).all(req.user.id);

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, create, update, remove, myProjects, myTasks };
