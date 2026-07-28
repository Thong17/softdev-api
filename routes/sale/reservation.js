const router = require('express').Router()
const { memoryStorage } = require('../../configs/multer')
const { index, create, checkIn, checkOut, update, detail, _delete, _import, batch } = require('../../controllers/reservationController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.requireStore, security.role(privilege.reservation.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.requireStore, security.role(privilege.reservation.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.requireStore, security.role(privilege.reservation.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/checkIn/:id', security.requireStore, security.role(privilege.reservation.update), security.audit(), (req, res) => {
    checkIn(req, res)
})

router.put('/checkOut/:id', security.requireStore, security.role(privilege.reservation.update), security.audit(), (req, res) => {
    checkOut(req, res)
})

router.put('/update/:id', security.requireStore, security.role(privilege.reservation.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/delete/:id', security.requireStore, security.role(privilege.reservation.delete), security.audit(), (req, res) => {
    _delete(req, res)
})

router.post('/excel/import', memoryStorage.single('excel'), (req, res) => {
    _import(req, res)
})

router.post('/batch', security.audit(), (req, res) => {
    batch(req, res)
})

module.exports = router