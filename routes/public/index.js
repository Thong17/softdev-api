const router = require('express').Router()
const { menu, brands, store, announcements, products } = require('../../controllers/publicController')

router.get('/menu', (req, res) => {
    menu(req, res)
})

router.get('/brands', (req, res) => {
    brands(req, res)
})

router.get('/store', (req, res) => {
    store(req, res)
})

router.get('/announcements', (req, res) => {
    announcements(req, res)
})

router.get('/products', (req, res) => {
    products(req, res)
})

module.exports = router
