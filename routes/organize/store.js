const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, create, update, detail, disable, _import, batch, floors, structures, layout, updateLayout, createFloor, updateFloor, disableFloor } = require('../../controllers/storeController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.store.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.store.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.store.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.store.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/layout/update/:id', security.role(privilege.store.update), security.audit(), (req, res) => {
    updateLayout(req, res)
})

router.delete('/disable/:id', security.role(privilege.store.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.get('/floor', (req, res) => {
    floors(req, res)
})

router.post('/floor/create', security.audit(), (req, res) => {
    createFloor(req, res)
})

router.put('/floor/update/:id', security.audit(), (req, res) => {
    updateFloor(req, res)
})

router.delete('/floor/disable/:id', security.role(privilege.store.delete), security.audit(), (req, res) => {
    disableFloor(req, res)
})

router.get('/structure', (req, res) => {
    structures(req, res)
})

router.get('/layout', (req, res) => {
    layout(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router