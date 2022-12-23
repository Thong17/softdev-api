const router = require('express').Router()

router.use('/queue', require('./queue'))

module.exports = router