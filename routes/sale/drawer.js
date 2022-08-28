const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, open, save, close, detail, _import, batch } = require('../../controllers/drawerController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.drawer.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.drawer.detail), (req, res) => {
    detail(req, res)
})

router.post('/open', security.role(privilege.drawer.create), (req, res) => {
    open(req, res)
})

router.put('/save/:id', security.role(privilege.drawer.update), (req, res) => {
    save(req, res)
})

router.put('/close/:id', security.role(privilege.drawer.update), (req, res) => {
    close(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', (req, res) => {
    batch(req, res)
})

module.exports = router