const router = require('express').Router()

router.use('/stock', require('./stock'))
router.use('/promotion', require('./promotion'))

module.exports = router