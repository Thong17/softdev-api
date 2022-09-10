const router = require('express').Router()

router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))

module.exports = router