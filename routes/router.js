const router = require('express').Router()

router.use('/auth', require('./auth/auth'))
router.use(require('../middleware/security').auth)
router.use('/admin', require('./admin'))

module.exports = router