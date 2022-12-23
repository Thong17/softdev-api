const router = require('express').Router()

router.use('/auth', require('./auth/auth'))
router.use(require('../middleware/security').auth)
router.use('/shared', require('./shared'))
router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))
router.use('/sale', require('./sale'))
router.use('/function', require('./function'))
router.use('/user', require('./user'))
router.use('/report', require('./report'))
router.use('/dashboard', require('./dashboard'))

module.exports = router