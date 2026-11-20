const router = require('express').Router()
const multer = require('multer')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')
const response = require('../../helpers/response')
const { productTemplate, previewProducts, importProducts, stockTemplate, stockTemplateOptions, stockTemplateProducts, previewStock, importStock, previewImages, uploadImages, onlineStatus, onlineProducts, onlineSearch, onlineSave } = require('../../controllers/migrationController')

const canMigrate = security.role(privilege.admin.migration)
// Adding stock also needs the right to add stock elsewhere (/sale/stock/create)
const canAddStock = security.role(privilege.product.create)

// Kept in memory: the Excel is only read; images are only stored once matched
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('excel')
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
}).array('files', 20)

// Upload errors (too big, too many) as a message instead of a crash
const withUpload = (upload, handler) => (req, res) => upload(req, res, (err) => {
    if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'A file is too big (images 5 MB, Excel 10 MB)'
            : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Send at most 20 images at a time'
            : 'Upload failed'
        return response.failure(422, { msg }, res)
    }
    handler(req, res)
})

router.get('/product/template', canMigrate, productTemplate)
router.post('/product/preview', canMigrate, withUpload(excelUpload, previewProducts))
router.post('/product/import', canMigrate, security.audit(), importProducts)
router.get('/stock/template', canMigrate, stockTemplate)
router.get('/stock/template/options', canMigrate, stockTemplateOptions)
router.post('/stock/template/products', canMigrate, stockTemplateProducts)
router.post('/stock/template', canMigrate, stockTemplate)
router.post('/stock/preview', canMigrate, withUpload(excelUpload, previewStock))
router.post('/stock/import', canMigrate, canAddStock, security.audit(), importStock)
router.post('/image/preview', canMigrate, previewImages)
router.post('/image/upload', canMigrate, security.audit(), withUpload(imageUpload, uploadImages))

// Find product photos online (Pexels) and save the picked ones
router.get('/online/status', canMigrate, onlineStatus)
router.post('/online/products', canMigrate, onlineProducts)
router.post('/online/search', canMigrate, onlineSearch)
router.post('/online/save', canMigrate, security.audit(), onlineSave)

module.exports = router
