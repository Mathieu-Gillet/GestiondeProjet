const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { login, ldapLogin, logout, me } = require('../controllers/authController');

router.post('/login', login);
router.post('/ldap', ldapLogin);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
