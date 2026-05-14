const router = require('express').Router()
const { index, create, update, detail, disable, getBestDiscount, getCustomerDiscounts, assignToCustomer, removeFromCustomer } = require('../../controllers/membershipController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

// Membership CRUD routes
router.get('/', security.role(privilege.membership.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.membership.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.membership.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.membership.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.role(privilege.membership.delete), security.audit(), (req, res) => {
    disable(req, res)
})

// Discount calculation routes
router.get('/discount/best/:productId/:customerId', (req, res) => {
    getBestDiscount(req, res)
})

router.get('/discount/customer/:customerId', (req, res) => {
    getCustomerDiscounts(req, res)
})

// Customer membership management routes
router.post('/assign', security.role(privilege.membership.update), security.audit(), (req, res) => {
    assignToCustomer(req, res)
})

router.delete('/customer/:customerId', security.role(privilege.membership.update), security.audit(), (req, res) => {
    removeFromCustomer(req, res)
})

module.exports = router