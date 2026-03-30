require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticate } = require('./middleware/auth');
const { addClient, removeClient } = require('./sse');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',').map(o => o.trim()) : false)
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// SSE — temps réel (doit être avant les routes JSON pour éviter le parsing)
app.get('/api/events', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(':connected\n\n');
  addClient(req.user.id, res);

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(req.user.id, res);
  });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/date-requests', require('./routes/dateRequests'));
app.use('/api/export',        require('./routes/export'));

// En production : servir le frontend React compilé
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
}

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
