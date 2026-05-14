const router = require('express').Router()

router.use('/category', require('./category'))
router.use('/brand', require('./brand'))
router.use('/product', require('./product'))
router.use('/store', require('./store'))
router.use('/customer', require('./customer'))
router.use('/preset', require('./preset'))
router.use('/membership', require('./membership'))

module.exports = router
