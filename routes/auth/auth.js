const router = require('express').Router()
const security = require('../../middleware/security')
const { login, register } = require('../../controllers/authController')


router.post('/login', security.hash, (req, res) => {
    login(req, res)
})

router.post('/register', security.hash, (req, res) => {
    register(req, res)
})

module.exports = router