const router = require('express').Router()

router.use('/queue', require('./queue'))
router.use('/promotion', require('./promotion'))

module.exports = router