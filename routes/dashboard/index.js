const router = require('express').Router()

router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))
router.use('/operation', require('./operation'))
router.use('/function', require('./function'))

module.exports = router