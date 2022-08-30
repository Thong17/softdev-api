const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, create, detail, _import, batch } = require('../../controllers/paymentController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.payment.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.payment.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.payment.create), (req, res) => {
    create(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', (req, res) => {
    batch(req, res)
})

module.exports = router