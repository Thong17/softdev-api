const router = require('express').Router()
const multer = require('multer')
const upload = multer()
const { index, create, update, detail, remove, _import, batch } = require('../../controllers/transactionController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.transaction.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.transaction.detail), (req, res) => {
    detail(req, res)
})

router.post('/add', security.role(privilege.transaction.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.transaction.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/remove/:id', security.role(privilege.transaction.delete), security.audit(), (req, res) => {
    remove(req, res)
})

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router