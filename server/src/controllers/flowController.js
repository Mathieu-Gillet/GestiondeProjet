const { z } = require('zod');
const { getDb } = require('../db/database');

// Singleton SQLite (identique aux autres controllers)
const db = getDb();

const diagramSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  pole:        z.enum(['dev', 'network', 'all']).optional().default('all'),
});

const canvasSchema = z.object({
  nodes: z.array(z.object({
    id:          z.string(),
    type:        z.string().default('process'),
    data:        z.object({
      label:       z.string().default(''),
      description: z.string().optional().default(''),
      color:       z.string().optional().default('#6B7280'),
    }),
    position: z.object({ x: z.number(), y: z.number() }),
    width:    z.number().optional().nullable(),
    height:   z.number().optional().nullable(),
  })),
  edges: z.array(z.object({
    id:           z.string(),
    source:       z.string(),
    target:       z.string(),
    sourceHandle: z.string().optional().nullable(),
    targetHandle: z.string().optional().nullable(),
    label:        z.string().optional().default(''),
    type:         z.string().optional().default('smoothstep'),
    animated:     z.boolean().optional().default(false),
    data:         z.object({ dashed: z.boolean().optional().default(false) }).optional(),
  })),
});

function list(req, res) {
  try {
    const { pole } = req.query;
    let query = `
      SELECT fd.*, u.username AS author
      FROM flow_diagrams fd
      LEFT JOIN users u ON u.id = fd.created_by
    `;
    const params = [];
    if (pole && pole !== 'all') {
      query += ` WHERE (fd.pole = ? OR fd.pole = 'all')`;
      params.push(pole);
    }
    query += ' ORDER BY fd.updated_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getOne(req, res) {
  try {
    const { id } = req.params;
    const diagram = db.prepare(`
      SELECT fd.*, u.username AS author
      FROM flow_diagrams fd
      LEFT JOIN users u ON u.id = fd.created_by
      WHERE fd.id = ?
    `).get(id);

    if (!diagram) return res.status(404).json({ error: 'Diagramme introuvable' });

    const nodes = db.prepare('SELECT * FROM flow_nodes WHERE diagram_id = ?').all(id);
    const edges = db.prepare('SELECT * FROM flow_edges WHERE diagram_id = ?').all(id);

    // Reconstituer le format ReactFlow
    const rfNodes = nodes.map((n) => ({
      id:       n.node_id,
      type:     n.type,
      position: { x: n.pos_x, y: n.pos_y },
      width:    n.width,
      height:   n.height,
      data: {
        label:       n.label,
        description: n.description,
        color:       n.color,
        metadata:    JSON.parse(n.metadata || '{}'),
      },
    }));

    const rfEdges = edges.map((e) => ({
      id:           e.edge_id,
      source:       e.source_node,
      target:       e.target_node,
      sourceHandle: e.source_handle,
      targetHandle: e.target_handle,
      label:        e.label,
      type:         e.edge_type,
      animated:     e.animated === 1,
      data:         { dashed: e.dashed === 1 },
    }));

    res.json({ ...diagram, nodes: rfNodes, edges: rfEdges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function create(req, res) {
  try {
    const parsed = diagramSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const { title, description, pole } = parsed.data;
    const result = db.prepare(`
      INSERT INTO flow_diagrams (title, description, pole, created_by)
      VALUES (?, ?, ?, ?)
    `).run(title, description, pole, req.user.id);

    const diagram = db.prepare('SELECT * FROM flow_diagrams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(diagram);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function update(req, res) {
  try {
    const { id } = req.params;
    const diagram = db.prepare('SELECT * FROM flow_diagrams WHERE id = ?').get(id);
    if (!diagram) return res.status(404).json({ error: 'Diagramme introuvable' });

    const parsed = diagramSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const fields = parsed.data;
    const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
    const vals = Object.values(fields);
    if (sets.length === 0) return res.json(diagram);

    db.prepare(`UPDATE flow_diagrams SET ${sets} WHERE id = ?`).run(...vals, id);
    res.json(db.prepare('SELECT * FROM flow_diagrams WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function remove(req, res) {
  try {
    const { id } = req.params;
    const diagram = db.prepare('SELECT id FROM flow_diagrams WHERE id = ?').get(id);
    if (!diagram) return res.status(404).json({ error: 'Diagramme introuvable' });
    db.prepare('DELETE FROM flow_diagrams WHERE id = ?').run(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function saveCanvas(req, res) {
  try {
    const { id } = req.params;
    const diagram = db.prepare('SELECT id FROM flow_diagrams WHERE id = ?').get(id);
    if (!diagram) return res.status(404).json({ error: 'Diagramme introuvable' });

    const parsed = canvasSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const { nodes, edges } = parsed.data;

    // Sauvegarde atomique : supprimer + réinsérer
    db.prepare('DELETE FROM flow_nodes WHERE diagram_id = ?').run(id);
    db.prepare('DELETE FROM flow_edges WHERE diagram_id = ?').run(id);

    const insertNode = db.prepare(`
      INSERT INTO flow_nodes (diagram_id, node_id, type, label, description, color, pos_x, pos_y, width, height, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const n of nodes) {
      insertNode.run(
        id,
        n.id,
        n.type || 'process',
        n.data.label || '',
        n.data.description || '',
        n.data.color || '#6B7280',
        n.position.x,
        n.position.y,
        n.width || 160,
        n.height || 60,
        JSON.stringify(n.data.metadata || {}),
      );
    }

    const insertEdge = db.prepare(`
      INSERT INTO flow_edges (diagram_id, edge_id, source_node, target_node, source_handle, target_handle, label, edge_type, animated, dashed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of edges) {
      insertEdge.run(
        id,
        e.id,
        e.source,
        e.target,
        e.sourceHandle || '',
        e.targetHandle || '',
        e.label || '',
        e.type || 'smoothstep',
        e.animated ? 1 : 0,
        e.data?.dashed ? 1 : 0,
      );
    }

    db.prepare('UPDATE flow_diagrams SET updated_at = datetime(\'now\') WHERE id = ?').run(id);
    res.json({ ok: true, nodes: nodes.length, edges: edges.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, update, remove, saveCanvas };
