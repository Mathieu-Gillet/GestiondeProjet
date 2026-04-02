const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/flowController');

const router = Router();

router.get('/',           authenticate, ctrl.list);
router.get('/:id',        authenticate, ctrl.getOne);
router.post('/',          authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.create);
router.put('/:id',        authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.update);
router.put('/:id/canvas', authenticate, requireRole('admin', 'directeur', 'responsable'), ctrl.saveCanvas);
router.delete('/:id',     authenticate, requireRole('admin', 'directeur'), ctrl.remove);

module.exports = router;
