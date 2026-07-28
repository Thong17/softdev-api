const router = require('express').Router()
const { getNotification } = require('../../controllers/alertController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/notification', security.requireStore, security.role(privilege.product.list), (req, res) => {
    getNotification(req, res)
})

module.exports = router