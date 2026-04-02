const { z } = require('zod');
const { getDb } = require('../db/database');
const { broadcast, broadcastToUser } = require('../sse');

const VALID_SERVICES = ['dev', 'network', 'rh', 'direction_generale', 'services_techniques', 'achats'];

const projectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  service: z.enum(VALID_SERVICES),
  pole: z.enum(['dev', 'network']).optional(), // legacy compat
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

function serviceToPole(service) {
  return service === 'network' ? 'network' : 'dev';
}

// Services couverts par le rôle DSI
const DSI_SERVICES = ['dev', 'network'];

// Admin système OU Direction Générale → accès complet tous services
function hasFullAccess(user) {
  return user.role === 'admin' || user.service === 'direction_generale';
}

// Peut voir tous les services (DG + admin)
function canSeeAllServices(user) {
  return hasFullAccess(user);
}

// Peut créer/modifier dans un service donné
function canManageService(user, service) {
  if (hasFullAccess(user)) return true;
  if (user.role === 'dsi' && DSI_SERVICES.includes(service)) return true;
  return ['directeur', 'responsable'].includes(user.role) && user.service === service;
}

// Peut supprimer dans un service donné
function canDeleteInService(user, service) {
  if (hasFullAccess(user)) return true;
  if (user.role === 'dsi' && DSI_SERVICES.includes(service)) return true;
  return user.role === 'directeur' && user.service === service;
}

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
    SELECT u.id, u.username, u.role, u.pole, u.service
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
    ? db.prepare('SELECT id, username, role, pole, service FROM users WHERE id = ?').get(project.owner_id)
    : null;

  return project;
}

function list(req, res) {
  let { service, status, priority, search } = req.query;
  const db = getDb();

  let dsiFilter = false;
  if (!canSeeAllServices(req.user)) {
    if (req.user.role === 'dsi') {
      if (service && !DSI_SERVICES.includes(service)) {
        return res.status(403).json({ error: 'Accès limité aux services dev et réseau' });
      }
      if (!service) dsiFilter = true;
    } else {
      service = req.user.service || 'dev';
    }
  }

  let query = 'SELECT * FROM projects WHERE 1=1';
  const params = [];

  if (dsiFilter) { query += ` AND service IN ('dev', 'network')`; }
  else if (service) { query += ' AND service = ?'; params.push(service); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (priority) { query += ' AND priority = ?'; params.push(priority); }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY status, position ASC, created_at DESC';

  const projects = db.prepare(query).all(...params);

  const enriched = projects.map(p => {
    p.tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN project_tags pt ON pt.tag_id = t.id WHERE pt.project_id = ?
    `).all(p.id);
    p.owner = p.owner_id
      ? db.prepare('SELECT id, username, role, pole, service FROM users WHERE id = ?').get(p.owner_id)
      : null;
    return p;
  });

  const allDeps = db.prepare('SELECT from_project_id, to_project_id FROM project_dependencies').all();
  enriched.forEach(p => {
    p.successors = allDeps.filter(d => d.from_project_id === p.id).map(d => d.to_project_id);
  });

  res.json(enriched);
}

function getOne(req, res) {
  const db = getDb();
  const project = getProjectWithRelations(db, req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  if (!canSeeAllServices(req.user)) {
    if (req.user.role === 'dsi') {
      if (!DSI_SERVICES.includes(project.service)) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
    } else if (req.user.service && req.user.service !== project.service) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
  }

  res.json(project);
}

function create(req, res) {
  const result = projectSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { title, description, service, owner_id, status, priority, start_date, due_date, member_ids, tag_ids } = result.data;
  const pole = serviceToPole(service);

  if (!canManageService(req.user, service)) {
    return res.status(403).json({ error: 'Vous ne pouvez créer des projets que dans votre service' });
  }

  const db = getDb();

  const maxPos = db.prepare('SELECT MAX(position) as m FROM projects WHERE status = ? AND service = ?').get(status, service);
  const position = (maxPos.m ?? -1) + 1;

  const info = db.prepare(`
    INSERT INTO projects (title, description, pole, service, owner_id, status, priority, position, start_date, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, pole, service, owner_id || null, status, priority, position, start_date || null, due_date || null);

  const projectId = info.lastInsertRowid;

  const insertMember = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
  const fromUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
  for (const uid of member_ids) {
    insertMember.run(projectId, uid);
    if (uid !== req.user.id) {
      const notifInfo = db.prepare(`
        INSERT INTO notifications (user_id, project_id, from_user_id, type, message)
        VALUES (?, ?, ?, 'project_member_added', ?)
      `).run(uid, projectId, req.user.id, `${fromUser?.username || 'Un responsable'} vous a ajouté au projet « ${title} »`);
      broadcastToUser(uid, 'notification', {
        id: notifInfo.lastInsertRowid,
        message: `${fromUser?.username || 'Un responsable'} vous a ajouté au projet « ${title} »`,
        project_id: projectId,
        type: 'project_member_added',
      });
    }
  }

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

  if (!canManageService(req.user, project.service)) {
    return res.status(403).json({ error: 'Accès limité à votre service' });
  }

  if (project.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le modifier.' });
  }

  const result = projectSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { member_ids, tag_ids, pole: _pole, ...fields } = result.data;

  if (fields.service) {
    fields.pole = serviceToPole(fields.service);
  }

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

  if (member_ids !== undefined) {
    const oldMemberIds = db.prepare('SELECT user_id FROM project_members WHERE project_id = ?')
      .all(req.params.id).map((r) => r.user_id);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
    const updatedProject = db.prepare('SELECT title FROM projects WHERE id = ?').get(req.params.id);
    const fromUserForMembers = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
    for (const uid of member_ids) {
      ins.run(req.params.id, uid);
      if (!oldMemberIds.includes(uid) && uid !== req.user.id) {
        const notifInfo = db.prepare(`
          INSERT INTO notifications (user_id, project_id, from_user_id, type, message)
          VALUES (?, ?, ?, 'project_member_added', ?)
        `).run(uid, req.params.id, req.user.id, `${fromUserForMembers?.username || 'Un responsable'} vous a ajouté au projet « ${updatedProject?.title} »`);
        broadcastToUser(uid, 'notification', {
          id: notifInfo.lastInsertRowid,
          message: `${fromUserForMembers?.username || 'Un responsable'} vous a ajouté au projet « ${updatedProject?.title} »`,
          project_id: Number(req.params.id),
          type: 'project_member_added',
        });
      }
    }
  }

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

  if (!canDeleteInService(req.user, project.service)) {
    return res.status(403).json({ error: 'Accès limité à votre service' });
  }

  if (project.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le supprimer.' });
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

  if (!canManageService(req.user, project.service)) {
    return res.status(403).json({ error: 'Accès limité à votre service' });
  }

  if (project.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le modifier.' });
  }

  const { status, position } = result.data;
  const oldStatus = project.status;

  db.prepare(`
    UPDATE projects SET position = position + 1
    WHERE status = ? AND service = ? AND position >= ? AND id != ?
  `).run(status, project.service, position, project.id);

  db.prepare('UPDATE projects SET status = ?, position = ? WHERE id = ?')
    .run(status, position, project.id);

  if (oldStatus !== status) {
    logActivity(db, project.id, req.user.id, 'status_changed', { from: oldStatus, to: status });
  }

  const moved = getProjectWithRelations(db, project.id);
  broadcast('project_updated', { id: project.id });
  res.json(moved);
}

function getComments(req, res) {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.username, u.role
    FROM comments c
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.project_id = ? AND c.task_id IS NULL
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

  if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres commentaires' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ message: 'Commentaire supprimé' });
}

function getTaskComments(req, res) {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.username, u.role
    FROM comments c
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.project_id = ? AND c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id, req.params.taskId);
  res.json(comments);
}

function addTaskComment(req, res) {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  const info = db.prepare(`
    INSERT INTO comments (project_id, task_id, author_id, content) VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.params.taskId, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT c.*, u.username, u.role FROM comments c
    LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(comment);
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

function addDependency(req, res) {
  const fromId = parseInt(req.params.id, 10);
  const toId   = parseInt(req.params.toId, 10);
  if (fromId === toId) return res.status(400).json({ error: 'Un projet ne peut pas dépendre de lui-même' });
  const db = getDb();
  try {
    db.prepare('INSERT OR IGNORE INTO project_dependencies (from_project_id, to_project_id) VALUES (?, ?)').run(fromId, toId);
    broadcast('project_updated', { id: fromId });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Dépendance invalide' });
  }
}

function removeDependency(req, res) {
  const fromId = parseInt(req.params.id, 10);
  const toId   = parseInt(req.params.toId, 10);
  const db = getDb();
  db.prepare('DELETE FROM project_dependencies WHERE from_project_id = ? AND to_project_id = ?').run(fromId, toId);
  broadcast('project_updated', { id: fromId });
  res.json({ ok: true });
}

module.exports = { list, getOne, create, update, remove, move, getComments, addComment, deleteComment, getTaskComments, addTaskComment, getActivity, addDependency, removeDependency };
