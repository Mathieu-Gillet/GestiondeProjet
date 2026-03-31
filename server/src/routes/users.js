const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/userController');

// Espace personnel — accessible à tous les utilisateurs connectés
router.get('/me/projects', authenticate, ctrl.myProjects);
router.get('/me/tasks',    authenticate, ctrl.myTasks);

// Gestion des utilisateurs : admin uniquement
router.get('/', authenticate, requireRole('admin'), ctrl.list);
router.post('/', authenticate, requireRole('admin'), ctrl.create);
router.put('/:id', authenticate, requireRole('admin'), ctrl.update);
router.delete('/:id', authenticate, requireRole('admin'), ctrl.remove);

module.exports = router;
