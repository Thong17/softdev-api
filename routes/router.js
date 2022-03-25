const router = require('express').Router()

router.use('/auth', require('./auth/auth'))

module.exports = router