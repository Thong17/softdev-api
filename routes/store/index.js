const router = require('express').Router()

router.use('/category', require('./category'))
router.use('/brand', require('./brand'))

module.exports = router