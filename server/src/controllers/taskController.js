const { getDb } = require('../db/database');
const { z } = require('zod');
const { broadcast, broadcastToUser } = require('../sse');

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const taskSchema = z.object({
  title:          z.string().min(1).max(200),
  duration_days:  z.number().int().min(0).default(1),
  status:         z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
  start_date:     dateStr,
  due_date:       dateStr,
  depends_on:     z.number().int().nullable().optional(),
  assigned_to:    z.number().int().nullable().optional(),
  notes:          z.string().nullable().optional(),
  earliest_start: dateStr,
  latest_end:     dateStr,
});

const STATUS_LABELS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };

// ── Helper : charge tâche avec joins ────────────────────────────────────────
function fetchTask(db, taskId) {
  return db.prepare(`
    SELECT t.*, dep.title AS depends_on_title, u.username AS assigned_to_username
    FROM tasks t
    LEFT JOIN tasks dep ON dep.id = t.depends_on
    LEFT JOIN users u   ON u.id  = t.assigned_to
    WHERE t.id = ?
  `).get(taskId);
}

// ── Helper : créer une notification ─────────────────────────────────────────
function createNotification(db, { userId, projectId, taskId, fromUserId, message }) {
  const info = db.prepare(`
    INSERT INTO notifications (user_id, project_id, task_id, from_user_id, type, message)
    VALUES (?, ?, ?, ?, 'task_status_changed', ?)
  `).run(userId, projectId, taskId, fromUserId, message);
  broadcastToUser(userId, 'notification', {
    id: info.lastInsertRowid, message, project_id: projectId, task_id: taskId,
  });
}

// ── list ────────────────────────────────────────────────────────────────────
function list(req, res) {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*,
           dep.title       AS depends_on_title,
           u.username      AS assigned_to_username
    FROM tasks t
    LEFT JOIN tasks dep ON dep.id = t.depends_on
    LEFT JOIN users u   ON u.id  = t.assigned_to
    WHERE t.project_id = ?
    ORDER BY t.position ASC, t.created_at ASC
  `).all(req.params.id);
  res.json(tasks);
}

// ── create ──────────────────────────────────────────────────────────────────
function create(req, res) {
  const result = taskSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  if (project.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le modifier.' });
  }

  const { title, duration_days, status, start_date, due_date, depends_on, assigned_to, notes, earliest_start, latest_end } = result.data;

  // Validation : start_date >= project.start_date
  if (start_date && project.start_date && start_date < project.start_date) {
    return res.status(400).json({
      error: `La date de début de la tâche ne peut pas être antérieure à la date de début du projet (${project.start_date}).`,
    });
  }

  // Validation : start_date >= depends_on.due_date
  if (depends_on && start_date) {
    const depTask = db.prepare('SELECT due_date FROM tasks WHERE id = ?').get(depends_on);
    if (depTask?.due_date && start_date < depTask.due_date) {
      return res.status(400).json({
        error: `La tâche ne peut pas commencer avant la fin de la tâche précédente (${depTask.due_date}).`,
      });
    }
  }

  const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE project_id = ?').get(req.params.id);
  const position = (maxPos.m ?? -1) + 1;

  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, duration_days, status, position, start_date, due_date, depends_on, assigned_to, notes, earliest_start, latest_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, duration_days, status, position,
      start_date ?? null, due_date ?? null, depends_on ?? null, assigned_to ?? null, notes ?? null,
      earliest_start ?? null, latest_end ?? null);

  const task = fetchTask(db, info.lastInsertRowid);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.status(201).json(task);
}

// ── update ──────────────────────────────────────────────────────────────────
function update(req, res) {
  const result = taskSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  const projectForArchive = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
  if (projectForArchive?.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le modifier.' });
  }

  const { title, duration_days, status, start_date, due_date, depends_on, assigned_to, earliest_start, latest_end } = result.data;

  // Validation dates
  if (start_date || due_date) {
    const project = db.prepare('SELECT start_date, due_date FROM projects WHERE id = ?').get(req.params.id);
    const effectiveStart = start_date !== undefined ? start_date : task.start_date;
    if (effectiveStart && project?.start_date && effectiveStart < project.start_date) {
      return res.status(400).json({
        error: `La date de début de la tâche ne peut pas être antérieure à la date de début du projet (${project.start_date}).`,
      });
    }
  }

  // Validation dépendance
  const effectiveDepends = depends_on !== undefined ? depends_on : task.depends_on;
  const effectiveStart   = start_date !== undefined ? start_date : task.start_date;
  if (effectiveDepends && effectiveStart) {
    const depTask = db.prepare('SELECT due_date FROM tasks WHERE id = ?').get(effectiveDepends);
    if (depTask?.due_date && effectiveStart < depTask.due_date) {
      return res.status(400).json({
        error: `La tâche ne peut pas commencer avant la fin de la tâche précédente (${depTask.due_date}).`,
      });
    }
  }

  const changes = [];
  const params  = [];
  if (title         !== undefined) { changes.push('title = ?');         params.push(title); }
  if (duration_days !== undefined) { changes.push('duration_days = ?'); params.push(duration_days); }
  if (status        !== undefined) { changes.push('status = ?');        params.push(status); }
  if (start_date    !== undefined) { changes.push('start_date = ?');    params.push(start_date ?? null); }
  if (due_date      !== undefined) { changes.push('due_date = ?');      params.push(due_date ?? null); }
  if (depends_on    !== undefined) { changes.push('depends_on = ?');    params.push(depends_on ?? null); }
  if (assigned_to   !== undefined) { changes.push('assigned_to = ?');   params.push(assigned_to ?? null); }
  if (notes          !== undefined) { changes.push('notes = ?');          params.push(notes ?? null); }
  if (earliest_start !== undefined) { changes.push('earliest_start = ?'); params.push(earliest_start ?? null); }
  if (latest_end     !== undefined) { changes.push('latest_end = ?');     params.push(latest_end ?? null); }

  if (changes.length > 0) {
    params.push(req.params.taskId);
    db.prepare(`UPDATE tasks SET ${changes.join(', ')} WHERE id = ?`).run(...params);
  }

  // Notification si statut changé
  if (status !== undefined && status !== task.status && req.user) {
    const project = db.prepare('SELECT owner_id, title FROM projects WHERE id = ?').get(req.params.id);
    if (project?.owner_id && project.owner_id !== req.user.id) {
      const fromUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
      const message = `${fromUser?.username || 'Un membre'} a changé le statut de « ${task.title} » : ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[status]} (${project.title})`;
      createNotification(db, {
        userId: project.owner_id,
        projectId: Number(req.params.id),
        taskId: Number(req.params.taskId),
        fromUserId: req.user.id,
        message,
      });
    }
  }

  const updated = fetchTask(db, req.params.taskId);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.json(updated);
}

// ── updateStatus — accessible à tous les membres pour leurs tâches ──────────
function updateStatus(req, res) {
  const result = z.object({ status: z.enum(['todo', 'in_progress', 'done']) }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Statut invalide' });

  const db   = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  // Un membre ne peut mettre à jour que ses propres tâches
  const isMember = req.user?.role === 'member';
  if (isMember && task.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres tâches.' });
  }

  const { status } = result.data;
  if (status !== task.status) {
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.taskId);

    // Notification au responsable du projet
    const project = db.prepare('SELECT owner_id, title FROM projects WHERE id = ?').get(req.params.id);
    if (project?.owner_id && project.owner_id !== req.user.id) {
      const fromUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
      const message = `${fromUser?.username || 'Un membre'} a changé le statut de « ${task.title} » : ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[status]} (${project.title})`;
      createNotification(db, {
        userId: project.owner_id,
        projectId: Number(req.params.id),
        taskId: Number(req.params.taskId),
        fromUserId: req.user.id,
        message,
      });
    }
  }

  const updated = fetchTask(db, req.params.taskId);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.json(updated);
}

// ── remove ──────────────────────────────────────────────────────────────────
function remove(req, res) {
  const db   = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  const projectForArchive = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
  if (projectForArchive?.status === 'done' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ce projet est archivé. Seul un administrateur peut le modifier.' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.json({ message: 'Tâche supprimée' });
}

// ── patchNotes — accessible à tous les utilisateurs pour leurs tâches ────────
function patchNotes(req, res) {
  const result = z.object({ notes: z.string().nullable() }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db   = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  if (req.user?.role === 'member' && task.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres tâches.' });
  }

  db.prepare('UPDATE tasks SET notes = ? WHERE id = ?').run(result.data.notes ?? null, req.params.taskId);
  const updated = fetchTask(db, req.params.taskId);
  res.json(updated);
}

module.exports = { list, create, update, updateStatus, patchNotes, remove };
