const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/',         authenticate, ctrl.list);
router.patch('/read',   authenticate, ctrl.markAllRead);
router.patch('/:id',    authenticate, ctrl.markRead);

module.exports = router;
