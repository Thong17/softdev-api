const router = require('express').Router()
const { organize } = require('../../controllers/dashboardController')

router.get('/', (req, res) => {
    organize(req, res)
})

module.exports = router