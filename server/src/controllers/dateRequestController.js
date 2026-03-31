const { getDb } = require('../db/database');
const { z } = require('zod');
const { broadcast, broadcastToUser } = require('../sse');

// ── Helper : créer une notification ─────────────────────────────────────────
function createNotification(db, { userId, projectId, taskId, fromUserId, type, message }) {
  const info = db.prepare(`
    INSERT INTO notifications (user_id, project_id, task_id, from_user_id, type, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, projectId ?? null, taskId ?? null, fromUserId ?? null, type, message);
  broadcastToUser(userId, 'notification', {
    id: info.lastInsertRowid, message, project_id: projectId, task_id: taskId, type,
  });
}

// ── create : soumettre une demande de modification de dates ──────────────────
function create(req, res) {
  const schema = z.object({
    new_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    new_due_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    reason:         z.string().max(500).nullable().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  const { new_start_date, new_due_date, reason } = result.data;
  if (!new_start_date && !new_due_date) {
    return res.status(400).json({ error: 'Au moins une nouvelle date est requise' });
  }

  // Vérifier qu'il n'y a pas déjà une demande pending pour cette tâche
  const existing = db.prepare(
    "SELECT id FROM task_date_requests WHERE task_id = ? AND status = 'pending'"
  ).get(task.id);
  if (existing) {
    return res.status(409).json({ error: 'Une demande est déjà en attente pour cette tâche' });
  }

  const info = db.prepare(`
    INSERT INTO task_date_requests
      (task_id, project_id, requested_by, current_start_date, current_due_date, new_start_date, new_due_date, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, project.id, req.user.id,
    task.start_date ?? null, task.due_date ?? null,
    new_start_date ?? null, new_due_date ?? null,
    reason ?? null,
  );

  // Notifier le responsable du projet
  if (project.owner_id && project.owner_id !== req.user.id) {
    const requester = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
    const msg = `${requester?.username || 'Un membre'} demande à modifier les dates de la tâche « ${task.title} » (${project.title})`;
    createNotification(db, {
      userId: project.owner_id,
      projectId: project.id,
      taskId: task.id,
      fromUserId: req.user.id,
      type: 'task_date_request',
      message: msg,
    });
  }

  const req_ = db.prepare(`
    SELECT r.*, t.title AS task_title, p.title AS project_title, u.username AS requester_username
    FROM task_date_requests r
    JOIN tasks    t ON t.id = r.task_id
    JOIN projects p ON p.id = r.project_id
    JOIN users    u ON u.id = r.requested_by
    WHERE r.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(req_);
}

// ── listForLead : demandes pending pour les projets dont on est responsable ──
function listForLead(req, res) {
  const db = getDb();
  let requests;
  if (req.user.role === 'admin') {
    requests = db.prepare(`
      SELECT r.*,
             t.title AS task_title,
             p.title AS project_title,
             u.username AS requester_username
      FROM task_date_requests r
      JOIN tasks    t ON t.id = r.task_id
      JOIN projects p ON p.id = r.project_id
      JOIN users    u ON u.id = r.requested_by
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `).all();
  } else {
    requests = db.prepare(`
      SELECT r.*,
             t.title AS task_title,
             p.title AS project_title,
             u.username AS requester_username
      FROM task_date_requests r
      JOIN tasks    t ON t.id = r.task_id
      JOIN projects p ON p.id = r.project_id
      JOIN users    u ON u.id = r.requested_by
      WHERE r.status = 'pending'
        AND p.owner_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id);
  }
  res.json(requests);
}

// ── listForTask : demandes pour une tâche spécifique ────────────────────────
function listForTask(req, res) {
  const db = getDb();
  const requests = db.prepare(`
    SELECT r.*, u.username AS requester_username
    FROM task_date_requests r
    JOIN users u ON u.id = r.requested_by
    WHERE r.task_id = ? AND r.project_id = ?
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all(req.params.taskId, req.params.id);
  res.json(requests);
}

// ── approve ──────────────────────────────────────────────────────────────────
function approve(req, res) {
  const schema = z.object({ response_note: z.string().max(500).nullable().optional() });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const request = db.prepare(`
    SELECT r.*, t.title AS task_title, p.owner_id, p.title AS project_title
    FROM task_date_requests r
    JOIN tasks    t ON t.id = r.task_id
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!request) return res.status(404).json({ error: 'Demande introuvable' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'Cette demande a déjà été traitée' });
  if (req.user.role !== 'admin' && request.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  // Mettre à jour les dates de la tâche
  const updates = [];
  const params  = [];
  if (request.new_start_date !== null) { updates.push('start_date = ?'); params.push(request.new_start_date); }
  if (request.new_due_date   !== null) { updates.push('due_date = ?');   params.push(request.new_due_date); }
  if (updates.length > 0) {
    params.push(request.task_id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Mettre à jour la demande
  db.prepare(`
    UPDATE task_date_requests SET status = 'approved', response_note = ? WHERE id = ?
  `).run(result.data.response_note ?? null, request.id);

  // Notifier le demandeur
  const msg = `Votre demande de modification des dates de la tâche « ${request.task_title} » a été approuvée (${request.project_title})`;
  createNotification(db, {
    userId: request.requested_by,
    projectId: request.project_id,
    taskId: request.task_id,
    fromUserId: req.user.id,
    type: 'task_date_approved',
    message: msg,
  });

  // Broadcast pour rafraîchir toutes les vues
  broadcast('tasks_updated', { project_id: request.project_id });

  res.json({ ok: true });
}

// ── reject ───────────────────────────────────────────────────────────────────
function reject(req, res) {
  const schema = z.object({ response_note: z.string().max(500).nullable().optional() });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const request = db.prepare(`
    SELECT r.*, t.title AS task_title, p.owner_id, p.title AS project_title
    FROM task_date_requests r
    JOIN tasks    t ON t.id = r.task_id
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!request) return res.status(404).json({ error: 'Demande introuvable' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'Cette demande a déjà été traitée' });
  if (req.user.role !== 'admin' && request.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  db.prepare(`
    UPDATE task_date_requests SET status = 'rejected', response_note = ? WHERE id = ?
  `).run(result.data.response_note ?? null, request.id);

  const noteStr = result.data.response_note ? ` — Motif : ${result.data.response_note}` : '';
  const msg = `Votre demande de modification des dates de la tâche « ${request.task_title} » a été refusée (${request.project_title})${noteStr}`;
  createNotification(db, {
    userId: request.requested_by,
    projectId: request.project_id,
    taskId: request.task_id,
    fromUserId: req.user.id,
    type: 'task_date_rejected',
    message: msg,
  });

  res.json({ ok: true });
}

module.exports = { create, listForLead, listForTask, approve, reject };
