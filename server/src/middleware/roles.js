// Rôles disponibles :
//  admin       — administrateur système local (tous droits, tous services)
//  dsi         — DSI (droits directeur sur dev ET réseau uniquement)
//  directeur   — directeur de service (tous droits sur son service, y compris suppression)
//  responsable — responsable de service (créer/modifier sur son service, pas de suppression)
//  membre      — membre (lecture, commentaires, mise à jour de ses tâches assignées)

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

// Vérifie que l'utilisateur est admin, ou directeur/responsable du service concerné
function requireServiceAccess(getService) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role === 'admin') return next();

    if (req.user.role === 'dsi') {
      const service = typeof getService === 'function' ? getService(req) : getService;
      if (!service || ['dev', 'network'].includes(service)) return next();
      return res.status(403).json({ error: 'Accès limité aux services dev et réseau' });
    }

    if (req.user.role === 'directeur' || req.user.role === 'responsable') {
      const service = typeof getService === 'function' ? getService(req) : getService;
      if (!service || req.user.service === service) return next();
      return res.status(403).json({ error: 'Accès limité à votre service' });
    }

    return res.status(403).json({ error: 'Permissions insuffisantes' });
  };
}

// Alias legacy pour la compatibilité avec les anciens appels internes
const requirePoleAccess = requireServiceAccess;

module.exports = { requireRole, requireServiceAccess, requirePoleAccess };
