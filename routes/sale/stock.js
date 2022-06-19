const router = require('express').Router()
const { index, stock, detail, detailStock, createStock, updateStock, disableStock } = require('../../controllers/stockController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.product.list), (req, res) => {
    index(req, res)
})

router.get('/list', security.role(privilege.product.list), (req, res) => {
    stock(req, res)
})

router.get('/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.product.create), (req, res) => {
    createStock(req, res)
})

router.put('/update/:id', security.role(privilege.product.update), (req, res) => {
    updateStock(req, res)
})

router.delete('/disable/:id', security.role(privilege.product.delete), (req, res) => {
    disableStock(req, res)
})


module.exports = router