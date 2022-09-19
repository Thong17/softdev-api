const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, create, save, detail, disable, _import, batch } = require('../../controllers/presetController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.preset.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.preset.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.preset.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/save/:id', security.role(privilege.preset.update), security.audit(), (req, res) => {
    save(req, res)
})

router.delete('/delete/:id', security.role(privilege.preset.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router