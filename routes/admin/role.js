const router = require('express').Router()
const { index, detail, create, getPrivilege, getPreRole } = require('../../controllers/roleController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/', security.role(privilege.role.list), (req, res) => {
    index(req, res)
})

router.get('/detail/:id', (req, res) => {
    detail(req, res)
})

router.get('/privilege', (req, res) => {
    getPrivilege(req, res)
})

router.get('/preRole', (req, res) => {
    getPreRole(req, res)
}) 

router.post('/create', (req, res) => {
    create(req, res)
})

module.exports = router