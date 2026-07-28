const router = require('express').Router()
const { operation } = require('../../controllers/dashboardController')
const security = require('../../middleware/security')

router.get('/', security.requireStore, (req, res) => {
    operation(req, res)
})

module.exports = router