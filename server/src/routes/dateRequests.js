const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/dateRequestController');

// Liste des demandes en attente (pour le lead/admin)
router.get('/', authenticate, ctrl.listForLead);

// Approuver / refuser une demande
router.patch('/:id/approve', authenticate, ctrl.approve);
router.patch('/:id/reject',  authenticate, ctrl.reject);

module.exports = router;
