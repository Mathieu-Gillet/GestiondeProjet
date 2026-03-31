const { getDb } = require('../db/database');

function list(req, res) {
  const db = getDb();
  const notifs = db.prepare(`
    SELECT n.*,
           fu.username AS from_username,
           p.title     AS project_title,
           t.title     AS task_title
    FROM notifications n
    LEFT JOIN users    fu ON fu.id = n.from_user_id
    LEFT JOIN projects p  ON p.id  = n.project_id
    LEFT JOIN tasks    t  ON t.id  = n.task_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifs);
}

function markRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
}

function markAllRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?')
    .run(req.user.id);
  res.json({ ok: true });
}

module.exports = { list, markRead, markAllRead };
