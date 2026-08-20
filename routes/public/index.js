const router = require('express').Router()
const { menu, brands, store } = require('../../controllers/publicController')

router.get('/menu', (req, res) => {
    menu(req, res)
})

router.get('/brands', (req, res) => {
    brands(req, res)
})

router.get('/store', (req, res) => {
    store(req, res)
})

module.exports = router
