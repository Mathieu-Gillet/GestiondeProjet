const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/exportController');

// Export Excel — admin et leads uniquement
router.get('/projects', authenticate, requireRole('admin', 'lead'), ctrl.exportProjects);

module.exports = router;
