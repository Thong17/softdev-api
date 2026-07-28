const router = require('express').Router()
const { admin } = require('../../controllers/dashboardController')
const security = require('../../middleware/security')

router.get('/', security.requireStore, (req, res) => {
    admin(req, res)
})

module.exports = router