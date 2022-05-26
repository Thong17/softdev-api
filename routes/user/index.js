const router = require('express').Router()
const { profile, changeTheme, changeLanguage } = require('../../controllers/userController')

router.get('/profile', (req, res) => {
    profile(req, res)
})

router.post('/theme/change', (req, res) => {
    changeTheme(req, res)
})

router.post('/language/change', (req, res) => {
    changeLanguage(req, res)
})

module.exports = router