const router = require('express').Router()
const { index, create } = require('../../controllers/roleController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.role.list), (req, res) => {
    index(req, res)
})
router.post('/create', security.role(privilege.role.create), (req, res) => {
    create(req, res)
})

module.exports = router