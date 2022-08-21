const router = require('express').Router()

router.use('/stock', require('./stock'))
router.use('/promotion', require('./promotion'))
router.use('/transaction', require('./transaction'))

module.exports = router