const { getDb } = require('../db/database');
const XLSX = require('xlsx');

const STATUS_LABELS = { backlog: 'Backlog', in_progress: 'En cours', on_hold: 'En attente', done: 'Terminé' };
const PRIO_LABELS   = { critical: 'Critique', high: 'Haute', normal: 'Normale', low: 'Faible' };
const POLE_LABELS   = { dev: 'Dev', network: 'Réseau' };
const TASK_LABELS   = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };

function exportProjects(req, res) {
  const db   = getDb();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  // Projets en cours ou terminés avec activité dans l'année courante
  const projects = db.prepare(`
    SELECT p.*, u.username AS owner_username
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.status IN ('in_progress', 'done')
      AND (
        p.start_date  <= :yearEnd   OR
        p.due_date    >= :yearStart OR
        p.updated_at  >= :yearStart OR
        p.created_at  >= :yearStart
      )
    ORDER BY p.pole ASC, p.status ASC, p.updated_at DESC
  `).all({ yearStart, yearEnd });

  const projectIds = projects.map((p) => p.id);

  const allTasks = projectIds.length > 0
    ? db.prepare(`
        SELECT t.*, p.title AS project_title, p.pole AS project_pole,
               u.username AS assigned_username
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.project_id IN (${projectIds.map(() => '?').join(',')})
        ORDER BY t.project_id ASC, t.position ASC
      `).all(...projectIds)
    : [];

  // ── Feuille 1 : Vue projets ──────────────────────────────────────────────
  const projectRows = projects.map((p) => {
    const tasks      = allTasks.filter((t) => t.project_id === p.id);
    const done       = tasks.filter((t) => t.status === 'done').length;
    const total      = tasks.length;
    const progress   = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      'Titre':            p.title,
      'Pôle':             POLE_LABELS[p.pole]     || p.pole,
      'Statut':           STATUS_LABELS[p.status] || p.status,
      'Priorité':         PRIO_LABELS[p.priority] || p.priority,
      'Responsable':      p.owner_username || '',
      'Date début':       p.start_date    || '',
      'Date fin prévue':  p.due_date      || '',
      'Tâches totales':   total,
      'Tâches terminées': done,
      'Avancement (%)':   progress,
      'Description':      p.description   || '',
    };
  });

  // ── Feuille 2 : Détail des tâches ────────────────────────────────────────
  const taskRows = allTasks.map((t) => ({
    'Projet':         t.project_title,
    'Pôle':           POLE_LABELS[t.project_pole] || t.project_pole,
    'Tâche':          t.title,
    'Statut':         TASK_LABELS[t.status]        || t.status,
    'Assignée à':     t.assigned_username || '',
    'Date début':     t.start_date        || '',
    'Date fin':       t.due_date          || '',
    'Durée (jours)':  t.duration_days     || '',
    'Notes':          t.notes             || '',
  }));

  const wb  = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(projectRows.length > 0 ? projectRows : [{ 'Info': 'Aucun projet pour cette période' }]);
  const ws2 = XLSX.utils.json_to_sheet(taskRows.length    > 0 ? taskRows    : [{ 'Info': 'Aucune tâche pour cette période' }]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Projets');
  XLSX.utils.book_append_sheet(wb, ws2, 'Tâches');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="projets_${year}.xlsx"`);
  res.send(buf);
}

module.exports = { exportProjects };
