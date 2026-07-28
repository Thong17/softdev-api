const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, stock, update, increaseQuantity, decreaseQuantity, detail, remove, reverseAll, _import, batch } = require('../../controllers/transactionController')
const security = require('../../middleware/security')
const middleware = require('../../middleware/function')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.requireStore, security.role(privilege.transaction.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.requireStore, security.role(privilege.transaction.detail), (req, res) => {
    detail(req, res)
})

router.post('/add', security.requireStore, security.role(privilege.transaction.create), security.audit(), (req, res) => {
    create(req, res)
})

router.post('/stock', security.requireStore, security.role(privilege.transaction.create), security.audit(), (req, res) => {
    stock(req, res)
})

router.put('/update/:id', security.requireStore, security.role(privilege.transaction.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/quantity/increase/:id', security.requireStore, security.role(privilege.transaction.update), security.audit(), (req, res) => {
    increaseQuantity(req, res)
})

router.put('/quantity/decrease/:id', security.requireStore, security.role(privilege.transaction.update), security.audit(), (req, res) => {
    decreaseQuantity(req, res)
})

router.delete('/remove/:id', security.requireStore, security.role(privilege.transaction.delete), security.audit(), (req, res) => {
    remove(req, res)
})

router.delete('/reverseAll', security.requireStore, security.role(privilege.transaction.delete), middleware.clearPendingTransaction(), security.audit(), (req, res) => {
    reverseAll(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router