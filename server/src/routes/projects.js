const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/projectController');
const taskCtrl = require('../controllers/taskController');

// Lecture : tous les utilisateurs authentifiés
router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getOne);
router.get('/:id/comments', authenticate, ctrl.getComments);
router.get('/:id/activity', authenticate, ctrl.getActivity);
router.get('/:id/tasks', authenticate, taskCtrl.list);

// Projets : admin et lead uniquement
router.post('/', authenticate, requireRole('admin', 'lead'), ctrl.create);
router.put('/:id', authenticate, requireRole('admin', 'lead'), ctrl.update);
router.delete('/:id', authenticate, requireRole('admin', 'lead'), ctrl.remove);
router.patch('/:id/move', authenticate, requireRole('admin', 'lead'), ctrl.move);

// Tâches : admin et lead uniquement
router.post('/:id/tasks', authenticate, requireRole('admin', 'lead'), taskCtrl.create);
router.put('/:id/tasks/:taskId', authenticate, requireRole('admin', 'lead'), taskCtrl.update);
router.delete('/:id/tasks/:taskId', authenticate, requireRole('admin', 'lead'), taskCtrl.remove);

// Commentaires : tous les utilisateurs
router.post('/:id/comments', authenticate, ctrl.addComment);
router.delete('/:id/comments/:commentId', authenticate, ctrl.deleteComment);

module.exports = router;
