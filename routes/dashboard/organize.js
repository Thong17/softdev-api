const router = require('express').Router()
const { organize } = require('../../controllers/dashboardController')
const security = require('../../middleware/security')

router.get('/', security.requireStore, (req, res) => {
    organize(req, res)
})

module.exports = router