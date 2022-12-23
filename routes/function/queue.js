const router = require('express').Router()
const { index, create, disable, update } = require('../../controllers/queueController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.queue.list), (req, res) => {
    index(req, res)
})

router.post('/create', security.role(privilege.queue.create), security.audit(), (req, res) => {
    create(req, res)
})

router.put('/update/:id', security.role(privilege.queue.update), security.audit(), (req, res) => {
    update(req, res)
})

router.delete('/cancel/:id', security.role(privilege.queue.cancel), security.audit(), (req, res) => {
    disable(req, res)
})


module.exports = router