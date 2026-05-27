const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, update, toggleStatus, toggleThermalPrinting, detail, disable, _import, _export, batch } = require('../../controllers/categoryController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.category.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.category.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.category.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.category.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/toggleStatus/:id', security.role(privilege.category.update), security.audit(), (req, res) => {
    toggleStatus(req, res)
})

router.put('/toggleThermalPrinting/:id', security.role(privilege.category.update), security.audit(), (req, res) => {
    toggleThermalPrinting(req, res)
})

router.delete('/disable/:id', security.role(privilege.category.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.post('/excel/export', security.role(privilege.category.list), (req, res) => {
    _export(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router