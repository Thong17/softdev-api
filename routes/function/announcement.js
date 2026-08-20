const router = require('express').Router()
const { index, create, update, toggleStatus, detail, disable } = require('../../controllers/announcementController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.announcement.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', security.role(privilege.announcement.detail), (req, res) => {
    detail(req, res)
})

router.post('/create', security.role(privilege.announcement.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.announcement.update), security.audit(), (req, res) => {
    update(req, res)
})

router.put('/toggleStatus/:id', security.role(privilege.announcement.update), security.audit(), (req, res) => {
    toggleStatus(req, res)
})

router.delete('/disable/:id', security.role(privilege.announcement.delete), security.audit(), (req, res) => {
    disable(req, res)
})

module.exports = router
