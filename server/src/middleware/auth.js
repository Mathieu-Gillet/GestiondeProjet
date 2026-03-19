const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Pour le SSE (EventSource ne supporte pas les headers custom), on accepte aussi ?token=
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, username, email, role, pole FROM users WHERE id = ?').get(payload.userId);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = { authenticate };
