const router = require('express').Router()
const { stock, detail, product, createStock, updateStock, disableStock, batch } = require('../../controllers/stockController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/list', security.requireStore, security.role(privilege.product.list), (req, res) => {
    stock(req, res)
})

router.get('/product/:id', security.requireStore, security.role(privilege.product.detail), (req, res) => {
    product(req, res)
})

router.get('/detail/:id', security.requireStore, security.role(privilege.product.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.requireStore, security.role(privilege.product.create), security.audit(), (req, res) => {
    createStock(req, res)
})

router.put('/update/:id', security.requireStore, security.role(privilege.product.update), security.audit(), (req, res) => {
    updateStock(req, res)
})

router.delete('/disable/:id', security.requireStore, security.role(privilege.product.delete), security.audit(), (req, res) => {
    disableStock(req, res)
})

router.post('/batch', security.requireStore, security.role(privilege.product.create), security.audit(), (req, res) => {
    batch(req, res)
})


module.exports = router