const router = require('express').Router()

router.use('/role', require('./role'))
router.use('/user', require('./user'))

module.exports = router