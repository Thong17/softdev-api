const router = require('express').Router()
const { index, listRequest, create, detail } = require('../../controllers/loanController')
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

router.post('/create', security.role(privilege.loan.create), security.audit(), (req, res) => {
    create(req, res)
})

module.exports = router