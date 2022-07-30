const router = require('express').Router()

router.use('/category', require('./category'))
router.use('/brand', require('./brand'))
router.use('/product', require('./product'))
router.use('/store', require('./store'))

module.exports = router