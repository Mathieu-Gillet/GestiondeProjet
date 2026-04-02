const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/projectController');
const taskCtrl = require('../controllers/taskController');
const dateRequestCtrl = require('../controllers/dateRequestController');

// Lecture : tous les utilisateurs authentifiés
router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getOne);
router.get('/:id/comments', authenticate, ctrl.getComments);
router.get('/:id/activity', authenticate, ctrl.getActivity);
router.get('/:id/tasks', authenticate, taskCtrl.list);

// Projets : créer/modifier = admin, directeur, responsable
router.post('/',       authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.create);
router.put('/:id',     authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.update);
router.patch('/:id/move', authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.move);
// Supprimer projet = admin et directeur uniquement (pas responsable)
router.delete('/:id',  authenticate, requireRole('admin', 'directeur'), ctrl.remove);

// Tâches : créer/modifier = admin, directeur, responsable
router.post('/:id/tasks',        authenticate, requireRole('admin', 'directeur', 'responsable'), taskCtrl.create);
router.put('/:id/tasks/:taskId', authenticate, requireRole('admin', 'directeur', 'responsable'), taskCtrl.update);
// Supprimer tâche = admin et directeur uniquement
router.delete('/:id/tasks/:taskId', authenticate, requireRole('admin', 'directeur'), taskCtrl.remove);
// Mise à jour du statut : tous les utilisateurs (membres peuvent valider leurs tâches)
router.patch('/:id/tasks/:taskId/status', authenticate, taskCtrl.updateStatus);
// Mise à jour des notes : tous les utilisateurs (membres pour leurs tâches)
router.patch('/:id/tasks/:taskId/notes',  authenticate, taskCtrl.patchNotes);

// Commentaires projet : tous les utilisateurs
router.post('/:id/comments', authenticate, ctrl.addComment);
router.delete('/:id/comments/:commentId', authenticate, ctrl.deleteComment);

// Commentaires de tâche : tous les utilisateurs
router.get('/:id/tasks/:taskId/comments', authenticate, ctrl.getTaskComments);
router.post('/:id/tasks/:taskId/comments', authenticate, ctrl.addTaskComment);
router.delete('/:id/tasks/:taskId/comments/:commentId', authenticate, ctrl.deleteComment);

// Demandes de modification de dates de tâche
router.post('/:id/tasks/:taskId/date-requests', authenticate, dateRequestCtrl.create);
router.get('/:id/tasks/:taskId/date-requests',  authenticate, dateRequestCtrl.listForTask);

// Dépendances entre projets — admin, directeur, responsable
router.post('/:id/dependencies/:toId',   authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.addDependency);
router.delete('/:id/dependencies/:toId', authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.removeDependency);

module.exports = router;
