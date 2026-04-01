const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getConfig, saveConfig, testConfig } = require('../controllers/ldapConfigController');

router.get('/',      authenticate, getConfig);
router.put('/',      authenticate, saveConfig);
router.post('/test', authenticate, testConfig);

module.exports = router;
