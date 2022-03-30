const router = require('express').Router()
const { index } = require('../../controllers/roleController')

router.get('/', (req, res) => {
    index(req, res)
})

module.exports = router