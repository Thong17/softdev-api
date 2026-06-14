const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, update, detail, disable, enableStock, _import, _export, batch, createProperty, updateProperty, reorderProperty, disableProperty, createOption, updateOption, toggleDefault, disableOption, detailOption, detailProperty, createColor, updateColor, disableColor, detailColor, createCustomerOption, detailCustomerOption, updateCustomerOption, disableCustomerOption, listProperty, clonePropertyOption } = require('../../controllers/productController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.product.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.product.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/stock/:id/enable', security.role(privilege.product.update), security.audit(), (req, res) => {
    enableStock(req, res)
})

router.delete('/disable/:id', security.role(privilege.product.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.post('/excel/export', security.role(privilege.product.list), (req, res) => {
    _export(req, res)
})

router.post('/excel/import', security.role(privilege.product.create), security.audit(), memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.role(privilege.product.create), security.audit(), (req, res) => {
    batch(req, res)
})

router.post('/property/create', security.role(privilege.product.create), security.audit(), (req, res) => {
    createProperty(req, res)
})

router.get('/property/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailProperty(req, res)
})

router.put('/property/update/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    updateProperty(req, res)
})

router.put('/property/reorder', security.role(privilege.product.update), security.audit(), (req, res) => {
    reorderProperty(req, res)
})

router.delete('/property/disable/:id', security.role(privilege.product.delete), security.audit(), (req, res) => {
    disableProperty(req, res)
})

router.post('/option/create', security.role(privilege.product.create), security.audit(), (req, res) => {
    createOption(req, res)
})

router.get('/option/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailOption(req, res)
})

router.put('/option/update/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    updateOption(req, res)
})

router.put('/option/toggle/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    toggleDefault(req, res)
})

router.delete('/option/disable/:id', security.role(privilege.product.delete), security.audit(), (req, res) => {
    disableOption(req, res)
})

router.post('/color/create', security.role(privilege.product.create), security.audit(), (req, res) => {
    createColor(req, res)
})

router.get('/color/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailColor(req, res)
})

router.put('/color/update/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    updateColor(req, res)
})

router.delete('/color/disable/:id', security.role(privilege.product.delete), security.audit(), (req, res) => {
    disableColor(req, res)
})

router.post('/customer/create', security.role(privilege.product.create), security.audit(), (req, res) => {
    createCustomerOption(req, res)
})

router.get('/customer/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailCustomerOption(req, res)
})

router.put('/customer/update/:id', security.role(privilege.product.update), security.audit(), (req, res) => {
    updateCustomerOption(req, res)
})

router.delete('/customer/disable/:id', security.role(privilege.product.delete), security.audit(), (req, res) => {
    disableCustomerOption(req, res)
})

router.get('/property/list', security.role(privilege.product.list), (req, res) => {
    listProperty(req, res)
})

router.put('/property/clone/:id', security.role(privilege.product.update), (req, res) => {
    clonePropertyOption(req, res)
})

module.exports = router