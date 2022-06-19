const router = require('express').Router()

router.use('/auth', require('./auth/auth'))
router.use('/shared', require('./shared'))
router.use(require('../middleware/security').auth)
router.use('/admin', require('./admin'))
router.use('/store', require('./store'))
router.use('/sale', require('./sale'))
router.use('/user', require('./user'))

module.exports = router