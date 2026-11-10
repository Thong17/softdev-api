const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, checkout, update, detail, _import, batch, groupPayment, groupCheckout } = require('../../controllers/paymentController')
const security = require('../../middleware/security')
const invoice = require('../../controllers/invoiceController')
const payLater = require('../../controllers/payLaterController')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.payment.list), (req, res) => {
    index(req, res)
})

// A4 / A5 soft invoice data for one sale or a group payment
router.get('/invoice/group/:id', security.role(privilege.payment.detail), (req, res) => {
    invoice.group(req, res)
})

router.get('/invoice/:id', security.role(privilege.payment.detail), (req, res) => {
    invoice.sale(req, res)
})

// Pay Later: check out with an optional deposit / due date / fee, then
// collect the balance over time
router.put('/checkout-later/:id', security.role(privilege.payment.update), security.audit(), (req, res) => {
    payLater.checkoutLater(req, res)
})

router.post('/collect/:id', security.role(privilege.payment.update), security.audit(), (req, res) => {
    payLater.collect(req, res)
})

router.get('/installments/:id', security.role(privilege.payment.detail), (req, res) => {
    payLater.installments(req, res)
})

router.get('/detail/:id', security.role(privilege.payment.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.payment.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.payment.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/checkout/:id', security.role(privilege.payment.update), security.audit(), (req, res) => {
    checkout(req, res)
})

router.put('/group-checkout', security.role(privilege.payment.update), security.audit(), (req, res) => {
    groupCheckout(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

router.post('/group-payment', security.role(privilege.payment.merge), security.audit(), (req, res) => {
    groupPayment(req, res)
})

module.exports = router