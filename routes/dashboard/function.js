const router = require('express').Router()
const { function: functionDashboard } = require('../../controllers/dashboardController')

router.get('/', (req, res) => {
    functionDashboard(req, res)
})

module.exports = router