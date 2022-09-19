const multer = require('multer')
const upload = multer()
const router = require('express').Router()
const { index, detail, create, disable, update, batch, _import, getPrivilege, getPreRole } = require('../../controllers/roleController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.role.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.role.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.role.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.role.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/disable/:id', security.role(privilege.role.delete), security.audit(), (req, res) => {
    disable(req, res)
})

router.get('/privilege', (req, res) => {
    getPrivilege(req, res)
})

router.get('/preRole', (req, res) => {
    getPreRole(req, res)
}) 

router.post('/excel/import', upload.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router