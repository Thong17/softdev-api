const router = require('express').Router()
const { list } = require('../../controllers/roleController')

router.get('/role/list', (req, res) => {
    list(req, res)
})

module.exports = router