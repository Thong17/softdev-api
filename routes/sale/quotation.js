const router = require('express').Router()
const { index, detail, create, update, _delete, _export } = require('../../controllers/quotationController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.quotation.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.quotation.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.quotation.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.quotation.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/delete/:id', security.role(privilege.quotation.delete), security.audit(), (req, res) => {
    _delete(req, res)
})

router.post('/excel/export/:id', security.role(privilege.quotation.detail), (req, res) => {
    _export(req, res)
})

module.exports = router
