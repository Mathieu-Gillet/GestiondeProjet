const { getDb } = require('../db/database');
const { z } = require('zod');
const { broadcast } = require('../sse');

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  duration_days: z.number().int().min(0).default(1),
  status: z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
  start_date: dateStr,
  due_date: dateStr,
  depends_on: z.number().int().nullable().optional(),
  assigned_to: z.number().int().nullable().optional(),
});

function list(req, res) {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*,
           dep.title AS depends_on_title,
           u.username AS assigned_to_username
    FROM tasks t
    LEFT JOIN tasks dep ON dep.id = t.depends_on
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.project_id = ?
    ORDER BY t.position ASC, t.created_at ASC
  `).all(req.params.id);
  res.json(tasks);
}

function create(req, res) {
  const result = taskSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });

  const { title, duration_days, status, start_date, due_date, depends_on, assigned_to } = result.data;
  const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE project_id = ?').get(req.params.id);
  const position = (maxPos.m ?? -1) + 1;

  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, duration_days, status, position, start_date, due_date, depends_on, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, duration_days, status, position, start_date ?? null, due_date ?? null, depends_on ?? null, assigned_to ?? null);

  const task = db.prepare(`
    SELECT t.*, dep.title AS depends_on_title, u.username AS assigned_to_username
    FROM tasks t LEFT JOIN tasks dep ON dep.id = t.depends_on LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = ?
  `).get(info.lastInsertRowid);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.status(201).json(task);
}

function update(req, res) {
  const result = taskSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const task = db.prepare(
    'SELECT * FROM tasks WHERE id = ? AND project_id = ?'
  ).get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  const changes = [];
  const params = [];
  const { title, duration_days, status, start_date, due_date, depends_on, assigned_to } = result.data;

  if (title !== undefined)         { changes.push('title = ?');         params.push(title); }
  if (duration_days !== undefined) { changes.push('duration_days = ?'); params.push(duration_days); }
  if (status !== undefined)        { changes.push('status = ?');        params.push(status); }
  if (start_date !== undefined)    { changes.push('start_date = ?');    params.push(start_date ?? null); }
  if (due_date !== undefined)      { changes.push('due_date = ?');      params.push(due_date ?? null); }
  if (depends_on !== undefined)    { changes.push('depends_on = ?');    params.push(depends_on ?? null); }
  if (assigned_to !== undefined)   { changes.push('assigned_to = ?');   params.push(assigned_to ?? null); }

  if (changes.length > 0) {
    params.push(req.params.taskId);
    db.prepare(`UPDATE tasks SET ${changes.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare(`
    SELECT t.*, dep.title AS depends_on_title, u.username AS assigned_to_username
    FROM tasks t LEFT JOIN tasks dep ON dep.id = t.depends_on LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = ?
  `).get(req.params.taskId);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const task = db.prepare(
    'SELECT * FROM tasks WHERE id = ? AND project_id = ?'
  ).get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  broadcast('tasks_updated', { project_id: Number(req.params.id) });
  res.json({ message: 'Tâche supprimée' });
}

module.exports = { list, create, update, remove };
