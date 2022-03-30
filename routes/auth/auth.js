const router = require('express').Router()
const security = require('../../middleware/security')
const { login, signup, createHash } = require('../../controllers/authController')


router.post('/login', security.hash, (req, res) => {
    login(req, res)
})

router.post('/signup', security.hash, (req, res) => {
    signup(req, res)
})

router.post('/generateHash', (req, res) => {
    createHash(req, res)
})

module.exports = router