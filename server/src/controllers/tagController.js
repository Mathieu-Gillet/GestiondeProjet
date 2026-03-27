const { z } = require('zod');
const { getDb } = require('../db/database');

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6B7280'),
});

function list(req, res) {
  const db = getDb();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.json(tags);
}

function create(req, res) {
  const result = tagSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Données invalides', details: result.error.flatten() });
  }

  const { name, color } = result.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Ce tag existe déjà' });

  const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(tag);
}

function update(req, res) {
  const result = tagSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Données invalides' });

  const db = getDb();
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag introuvable' });

  const { name, color } = result.data;
  const changes = [];
  const params = [];
  if (name  !== undefined) { changes.push('name = ?');  params.push(name); }
  if (color !== undefined) { changes.push('color = ?'); params.push(color); }

  if (changes.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE tags SET ${changes.join(', ')} WHERE id = ?`).run(...params);
  }
  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag introuvable' });

  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ message: 'Tag supprimé' });
}

module.exports = { list, create, update, remove };
