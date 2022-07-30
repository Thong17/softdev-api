const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, create, update, detail, disable, _import, batch, batchColor, batchImage, batchOption, batchProperty, createProperty, updateProperty, reorderProperty, disableProperty, createOption, updateOption, disableOption, detailOption, detailProperty, createColor, updateColor, disableColor, detailColor } = require('../../controllers/productController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.product.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.product.create), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.product.update), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.role(privilege.product.delete), (req, res) => {
    disable(req, res)
})

router.post('/excel/import', security.role(privilege.product.create), upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.role(privilege.product.create), (req, res) => {
    batch(req, res)
})

router.post('/color/batch', security.role(privilege.product.create), (req, res) => {
    batchColor(req, res)
})

router.post('/image/batch', security.role(privilege.product.create), (req, res) => {
    batchImage(req, res)
})

router.post('/property/batch', security.role(privilege.product.create), (req, res) => {
    batchProperty(req, res)
})

router.post('/option/batch', security.role(privilege.product.create), (req, res) => {
    batchOption(req, res)
})

router.post('/property/create', security.role(privilege.product.create), (req, res) => {
    createProperty(req, res)
})

router.get('/property/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailProperty(req, res)
})

router.put('/property/update/:id', security.role(privilege.product.update), (req, res) => {
    updateProperty(req, res)
})

router.put('/property/reorder', security.role(privilege.product.update), (req, res) => {
    reorderProperty(req, res)
})

router.delete('/property/disable/:id', security.role(privilege.product.delete), (req, res) => {
    disableProperty(req, res)
})

router.post('/option/create', security.role(privilege.product.create), (req, res) => {
    createOption(req, res)
})

router.get('/option/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailOption(req, res)
})

router.put('/option/update/:id', security.role(privilege.product.update), (req, res) => {
    updateOption(req, res)
})

router.delete('/option/disable/:id', security.role(privilege.product.delete), (req, res) => {
    disableOption(req, res)
})

router.post('/color/create', security.role(privilege.product.create), (req, res) => {
    createColor(req, res)
})

router.get('/color/detail/:id', security.role(privilege.product.detail), (req, res) => {
    detailColor(req, res)
})

router.put('/color/update/:id', security.role(privilege.product.update), (req, res) => {
    updateColor(req, res)
})

router.delete('/color/disable/:id', security.role(privilege.product.delete), (req, res) => {
    disableColor(req, res)
})


module.exports = router