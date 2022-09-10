const router = require('express').Router()
const { operation } = require('../../controllers/dashboardController')

router.get('/', (req, res) => {
    operation(req, res)
})

module.exports = router