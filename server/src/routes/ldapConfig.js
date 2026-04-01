const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getConfig, saveConfig, testConfig, searchUsers, importUsers } = require('../controllers/ldapConfigController');

router.get('/',           authenticate, getConfig);
router.put('/',           authenticate, saveConfig);
router.post('/test',      authenticate, testConfig);
router.get('/users',      authenticate, searchUsers);
router.post('/import',    authenticate, importUsers);

module.exports = router;
