const router = require('express').Router()
const { menu } = require('../../controllers/publicController')

router.get('/menu', (req, res) => {
    menu(req, res)
})

module.exports = router
