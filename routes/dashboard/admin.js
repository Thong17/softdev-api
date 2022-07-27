const router = require('express').Router()
const { admin } = require('../../controllers/dashboardController')

router.get('/', (req, res) => {
    admin(req, res)
})

module.exports = router