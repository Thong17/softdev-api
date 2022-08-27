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

router.post('/create', security.role(privilege.preset.create), (req, res) => {
    create(req, res)
})

router.put('/save/:id', security.role(privilege.preset.update), (req, res) => {
    save(req, res)
})

router.delete('/delete/:id', security.role(privilege.preset.delete), (req, res) => {
    disable(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', (req, res) => {
    batch(req, res)
})

module.exports = router