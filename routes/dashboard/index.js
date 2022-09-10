const router = require('express').Router()

router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))
router.use('/operation', require('./operation'))

module.exports = router