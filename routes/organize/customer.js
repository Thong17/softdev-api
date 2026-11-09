const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, update, detail, disable, _import, batch, rm, options } = require('../../controllers/customerController')
const security = require('../../middleware/security')
const customerTier = require('../../controllers/customerTierController')
const priceHistory = require('../../controllers/priceHistoryController')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.customer.list), (req, res) => {
    index(req, res)
})

// Customer list (Function › Customer): last purchase, spending and the "no purchase" remark
router.get('/rm', security.role(privilege.customer.list), (req, res) => {
    rm(req, res)
})

// Customer tiers (Bronze / Silver / ...): settings and per-customer status
router.get('/tier', security.role(privilege.customer.list), (req, res) => {
    customerTier.list(req, res)
})

router.put('/tier', security.role(privilege.customer.update), security.audit(), (req, res) => {
    customerTier.save(req, res)
})

router.post('/tier/recalculate', security.role(privilege.customer.update), security.audit(), (req, res) => {
    customerTier.recalculate(req, res)
})

router.get('/tier/status/:id', security.role(privilege.customer.detail), (req, res) => {
    customerTier.status(req, res)
})

// What customers paid per product; the controller checks customer or
// product access depending on the filter
router.get('/price-history', (req, res) => {
    priceHistory.list(req, res)
})

router.get('/options', security.role(privilege.customer.list), (req, res) => {
    options(req, res)
})

router.get('/detail/:id', security.role(privilege.customer.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.customer.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.customer.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.role(privilege.customer.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.role(privilege.customer.create), security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router