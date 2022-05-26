const router = require('express').Router()
const { index, create } = require('../../controllers/categoryController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.category.list), (req, res) => {
    index(req, res)
})

router.post('/create', security.role(privilege.category.create), (req, res) => {
    create(req, res)
})

module.exports = router