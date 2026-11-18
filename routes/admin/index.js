const router = require('express').Router()

router.use('/role', require('./role'))
router.use('/user', require('./user'))
router.use('/migration', require('./migration'))

module.exports = router