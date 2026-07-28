const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, update, detail, disable, _import, batch, floors, listTransfer, structures, layout, updateLayout, createFloor, updateFloor, disableFloor, createTransfer, updateTransfer, deleteTransfer, updateStoreSetting: updateTelegramSetting, getStoreSetting: getTelegramSetting } = require('../../controllers/storeController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.store.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.store.detail), (req, res) => {
    detail(req, res)
})

// Anyone authenticated may create their first store, since a brand-new
// user has no store membership (and therefore no privilege) yet.
router.post('/create', security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.store.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/layout/update/:id', security.requireStore, security.role(privilege.store.update), security.audit(), (req, res) => {
    updateLayout(req, res)
})

router.delete('/disable/:id', security.role(privilege.store.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.get('/floor', security.requireStore, security.role(privilege.store.list), (req, res) => {
    floors(req, res)
})

router.get('/transfer', security.requireStore, security.role(privilege.store.list), (req, res) => {
    listTransfer(req, res)
})

router.post('/floor/create', security.requireStore, security.role(privilege.store.create), security.audit(), (req, res) => {
    createFloor(req, res)
})

router.post('/transfer/create', security.requireStore, security.role(privilege.store.create), security.audit(), (req, res) => {
    createTransfer(req, res)
})

router.put('/transfer/update/:id', security.requireStore, security.role(privilege.store.update), security.audit(), (req, res) => {
    updateTransfer(req, res)
})

router.put('/floor/update/:id', security.requireStore, security.role(privilege.store.update), security.audit(), (req, res) => {
    updateFloor(req, res)
})

router.delete('/transfer/delete/:id', security.requireStore, security.role(privilege.store.delete), security.audit(), (req, res) => {
    deleteTransfer(req, res)
})

router.delete('/floor/disable/:id', security.requireStore, security.role(privilege.store.delete), security.audit(), (req, res) => {
    disableFloor(req, res)
})

router.get('/structure', security.requireStore, security.role(privilege.store.list), (req, res) => {
    structures(req, res)
})

router.get('/layout', security.requireStore, security.role(privilege.store.list), (req, res) => {
    layout(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

router.get('/getTelegramSetting', security.requireStore, security.role(privilege.store.detail), security.audit(), (req, res) => {
    getTelegramSetting(req, res)
})

router.put('/updateTelegramSetting', security.requireStore, security.role(privilege.store.update), security.audit(), (req, res) => {
    updateTelegramSetting(req, res)
})

module.exports = router
