const router = require('express').Router()

router.use('/queue', require('./queue'))
router.use('/loan', require('./loan'))

module.exports = router