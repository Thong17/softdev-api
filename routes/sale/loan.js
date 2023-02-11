const router = require('express').Router()
const { index, listRequest, create, detail, cancel, reject, approve, checkout } = require('../../controllers/loanController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.loan.list), (req, res) => {
    index(req, res)
})

router.get('/listRequest', security.role(privilege.loan.list), (req, res) => {
    listRequest(req, res)
})

router.get('/detail/:id', security.role(privilege.loan.detail), (req, res) => {
    detail(req, res)
})

router.delete('/cancel/:id', security.role(privilege.loan.cancel), security.audit(), (req, res) => {
    cancel(req, res)
})

router.put('/reject/:id', security.role(privilege.loan.reject), security.audit(), (req, res) => {
    reject(req, res)
})

router.put('/approve/:id', security.role(privilege.loan.approve), security.audit(), (req, res) => {
    approve(req, res)
})

router.post('/create', security.role(privilege.loan.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/checkout/:id', security.role(privilege.loan.update), security.audit(), (req, res) => {
    checkout(req, res)
})

module.exports = router