function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
  };
}

// Vérifie que l'utilisateur est admin, ou lead du pôle concerné
function requirePoleAccess(getPole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role === 'admin') return next();

    if (req.user.role === 'lead') {
      const pole = typeof getPole === 'function' ? getPole(req) : getPole;
      if (!pole || req.user.pole === pole) return next();
      return res.status(403).json({ error: 'Accès limité à votre pôle' });
    }

    return res.status(403).json({ error: 'Permissions insuffisantes' });
  };
}

module.exports = { requireRole, requirePoleAccess };
