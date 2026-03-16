const { z } = require('zod');
const { getDb } = require('../db/database');
const { broadcast } = require('../sse');

const projectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  pole: z.enum(['dev', 'network']),
  owner_id: z.number().int().positive().optional().nullable(),
  status: z.enum(['backlog', 'in_progress', 'on_hold', 'done']).optional().default('backlog'),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional().default('normal'),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  earliest_start: z.string().optional().nullable(),
  latest_end: z.string().optional().nullable(),
  member_ids: z.array(z.number().int().positive()).optional().default([]),
  tag_ids: z.array(z.number().int().positive()).optional().default([]),
});

const moveSchema = z.object({
  status: z.enum(['backlog', 'in_progress', 'on_hold', 'done']),
  position: z.number().int().min(0),
});

function logActivity(db, projectId, userId, action, detail = null) {
  db.prepare(`
    INSERT INTO activity_log (project_id, user_id, action, detail)
    VALUES (?, ?, ?, ?)
  `).run(projectId, userId, action, detail ? JSON.stringify(detail) : null);
}

function getProjectWithRelations(db, id) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return null;

  project.members = db.prepare(`
    SELECT u.id, u.username, u.role, u.pole
    FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(id);

  project.tags = db.prepare(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN project_tags pt ON pt.tag_id = t.id
    WHERE pt.project_id = ?
  `).all(id);

  project.owner = project.owner_id
    ? db.prepare('SELECT id, username, role, pole FROM users WHERE id = ?').get(project.owner_id)
    : null;

  return project;
}

function list(req, res) {
  let { pole, status, priority, search } = req.query;
  const db = getDb();

  // Les membres sont restreints à leur propre pôle
  if (req.user.role === 'member') {
    pole = req.user.pole || '__none__';
  }

  let query = 'SELECT * FROM projects WHERE 1=1';
  const params = [];

  if (pole) { query += ' AND pole = ?'; params.push(pole); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (priority) { query += ' AND priority = ?'; params.push(priority); }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY status, position ASC, created_at DESC';

  const projects = db.prepare(query).all(...params);

  // Enrichir avec tags et membres
  const enriched = projects.map(p => {
    p.tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN project_tags pt ON pt.tag_id = t.id WHERE pt.project_id = ?
    `).all(p.id);
    p.owner = p.owner_id
      ? db.prepare('SELECT id, username, role, pole FROM users WHERE id = ?').get(p.owner_id)
      : null;
    return p;
  });

  res.json(enriched);
}

function getOne(req, res) {
  const db = getDb();
  const project = getProjectWithRelations(db, req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  // Les membres ne peuvent voir que leur pôle
  if (req.user.role === 'member' && req.user.pole && req.user.pole !== project.pole) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  res.json(project);
}

function create(req, res) {
  const result = projectSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { title, description, pole, owner_id, status, priority, start_date, due_date, member_ids, tag_ids } = result.data;

  // Un lead ne peut créer que dans son pôle
  if (req.user.role === 'lead' && req.user.pole !== pole) {
    return res.status(403).json({ error: 'Vous ne pouvez créer des projets que dans votre pôle' });
  }

  const db = getDb();

  // Position = dernier dans la colonne
  const maxPos = db.prepare('SELECT MAX(position) as m FROM projects WHERE status = ? AND pole = ?').get(status, pole);
  const position = (maxPos.m ?? -1) + 1;

  const info = db.prepare(`
    INSERT INTO projects (title, description, pole, owner_id, status, priority, position, start_date, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, pole, owner_id || null, status, priority, position, start_date || null, due_date || null);

  const projectId = info.lastInsertRowid;

  // Membres
  const insertMember = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
  for (const uid of member_ids) insertMember.run(projectId, uid);

  // Tags
  const insertTag = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');
  for (const tid of tag_ids) insertTag.run(projectId, tid);

  logActivity(db, projectId, req.user.id, 'created');

  const project = getProjectWithRelations(db, projectId);
  broadcast('project_created', { id: projectId });
  res.status(201).json(project);
}

function update(req, res) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  // Vérification pôle pour lead
  if (req.user.role === 'lead' && req.user.pole !== project.pole) {
    return res.status(403).json({ error: 'Accès limité à votre pôle' });
  }

  const result = projectSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { member_ids, tag_ids, ...fields } = result.data;
  const changes = [];
  const params = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      changes.push(`${key} = ?`);
      params.push(val);
    }
  }

  if (changes.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE projects SET ${changes.join(', ')} WHERE id = ?`).run(...params);
  }

  // Mise à jour membres
  if (member_ids !== undefined) {
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
    for (const uid of member_ids) ins.run(req.params.id, uid);
  }

  // Mise à jour tags
  if (tag_ids !== undefined) {
    db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');
    for (const tid of tag_ids) ins.run(req.params.id, tid);
  }

  logActivity(db, req.params.id, req.user.id, 'updated');

  const updated = getProjectWithRelations(db, req.params.id);
  broadcast('project_updated', { id: Number(req.params.id) });
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  if (req.user.role === 'lead' && req.user.pole !== project.pole) {
    return res.status(403).json({ error: 'Accès limité à votre pôle' });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  broadcast('project_deleted', { id: Number(req.params.id) });
  res.json({ message: 'Projet supprimé' });
}

function move(req, res) {
  const result = moveSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  if (req.user.role === 'lead' && req.user.pole !== project.pole) {
    return res.status(403).json({ error: 'Accès limité à votre pôle' });
  }

  const { status, position } = result.data;
  const oldStatus = project.status;

  // Réordonner les projets dans la colonne cible (décaler vers le haut)
  db.prepare(`
    UPDATE projects SET position = position + 1
    WHERE status = ? AND pole = ? AND position >= ? AND id != ?
  `).run(status, project.pole, position, project.id);

  db.prepare('UPDATE projects SET status = ?, position = ? WHERE id = ?')
    .run(status, position, project.id);

  if (oldStatus !== status) {
    logActivity(db, project.id, req.user.id, 'status_changed', { from: oldStatus, to: status });
  }

  const moved = getProjectWithRelations(db, project.id);
  broadcast('project_updated', { id: project.id });
  res.json(moved);
}

// Commentaires
function getComments(req, res) {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.username, u.role
    FROM comments c
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.project_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
}

function addComment(req, res) {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  const info = db.prepare(`
    INSERT INTO comments (project_id, author_id, content) VALUES (?, ?, ?)
  `).run(req.params.id, req.user.id, content.trim());

  logActivity(db, req.params.id, req.user.id, 'commented');

  const comment = db.prepare(`
    SELECT c.*, u.username, u.role FROM comments c
    LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(comment);
}

function deleteComment(req, res) {
  const db = getDb();
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

  // Seul l'auteur ou un admin peut supprimer
  if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres commentaires' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ message: 'Commentaire supprimé' });
}

function getActivity(req, res) {
  const db = getDb();
  const logs = db.prepare(`
    SELECT a.*, u.username FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.project_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(logs);
}

module.exports = { list, getOne, create, update, remove, move, getComments, addComment, deleteComment, getActivity };
