const router = require('express').Router()

router.use('/auth', require('./auth/auth'))
router.use('/shared', require('./shared'))
router.use(require('../middleware/security').auth)
router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))
router.use('/sale', require('./sale'))
router.use('/user', require('./user'))
router.use('/dashboard', require('./dashboard'))

module.exports = router