const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getDb } = require('../db/database');

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function login(req, res) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  const { username, password } = result.data;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      pole: user.pole,
    },
  });
}

function logout(req, res) {
  // JWT est stateless — le client supprime le token
  res.json({ message: 'Déconnecté' });
}

function me(req, res) {
  res.json(req.user);
}

module.exports = { login, logout, me };
