const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, update, detail, disable, _import, batch } = require('../../controllers/customerController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.requireStore, security.role(privilege.brand.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.requireStore, security.role(privilege.brand.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.requireStore, security.role(privilege.brand.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.requireStore, security.role(privilege.brand.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.requireStore, security.role(privilege.brand.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router