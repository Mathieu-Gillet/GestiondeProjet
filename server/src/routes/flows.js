const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/flowController');

const router = Router();

router.get('/',     authenticate, ctrl.list);
router.post('/',    authenticate, requireRole('admin', 'lead'), ctrl.create);
router.get('/:id',  authenticate, ctrl.getOne);
router.put('/:id',  authenticate, requireRole('admin', 'lead'), ctrl.update);
router.delete('/:id', authenticate, requireRole('admin', 'lead'), ctrl.remove);
router.put('/:id/canvas', authenticate, requireRole('admin', 'lead'), ctrl.saveCanvas);

module.exports = router;
