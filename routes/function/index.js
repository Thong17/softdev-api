const router = require('express').Router()

router.use('/queue', require('./queue'))
router.use('/promotion', require('./promotion'))
router.use('/banner', require('./announcement'))

module.exports = router