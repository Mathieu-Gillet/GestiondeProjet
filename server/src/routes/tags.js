const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/tagController');

router.get('/',    authenticate, ctrl.list);
// Créer/modifier tag : admin, directeur, responsable
router.post('/',   authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.create);
router.put('/:id', authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.update);
// Supprimer tag : admin et directeur uniquement
router.delete('/:id', authenticate, requireRole('admin', 'directeur'), ctrl.remove);

module.exports = router;
