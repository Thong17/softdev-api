const router = require('express').Router()

router.use('/category', require('./category'))
router.use('/brand', require('./brand'))
router.use('/product', require('./product'))
router.use('/store', require('./store'))
router.use('/customer', require('./customer'))

module.exports = router