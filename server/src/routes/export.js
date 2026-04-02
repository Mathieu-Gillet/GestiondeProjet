const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/exportController');

// Export Excel — admin, directeur et responsable
router.get('/projects', authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.exportProjects);

module.exports = router;
