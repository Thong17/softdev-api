const router = require('express').Router()
const { login, signup } = require('../../controllers/authController')

router.post('/login', (req, res) => {
    login(req, res)
})

router.post('/signup', (req, res) => {
    signup(req, res)
})

module.exports = router