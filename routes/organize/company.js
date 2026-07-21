const router = require('express').Router()
const { index, create, update, detail, disable, list } = require('../../controllers/companyController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.company.list), (req, res) => {
    index(req, res)
})

router.get('/list', security.role(privilege.company.list), (req, res) => {
    list(req, res)
})

router.get('/detail/:id', security.role(privilege.company.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.company.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.company.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.role(privilege.company.delete), security.audit(), (req, res) => {
    disable(req, res)
})

module.exports = router
