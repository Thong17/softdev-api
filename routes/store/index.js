const router = require('express').Router()

router.get('/', (req, res) => {
    res.send()
})

router.use('/category', require('./category'))

module.exports = router