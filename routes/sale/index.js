const router = require('express').Router()

router.use('/stock', require('./stock'))
router.use('/promotion', require('./promotion'))
router.use('/transaction', require('./transaction'))
router.use('/drawer', require('./drawer'))
router.use('/payment', require('./payment'))
router.use('/reservation', require('./reservation'))

module.exports = router