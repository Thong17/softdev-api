const router = require('express').Router()

router.use('/stock', require('./stock'))

module.exports = router