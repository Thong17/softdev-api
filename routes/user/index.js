const router = require('express').Router()
const { profile, profileDetail, profileUpdate, passwordUpdate, changeTheme, changeLanguage, addFavorite, removeFavorite } = require('../../controllers/userController')
const security = require('../../middleware/security')

router.get('/profile', (req, res) => {
    profile(req, res)
})

router.get('/profile/:id', security.self, (req, res) => {
    profileDetail(req, res)
})

router.put('/profile/:id', security.self, (req, res) => {
    profileUpdate(req, res)
})

router.put('/change-password/:id', security.self, (req, res) => {
    passwordUpdate(req, res)
})

router.post('/theme/change', (req, res) => {
    changeTheme(req, res)
})

router.post('/language/change', (req, res) => {
    changeLanguage(req, res)
})

router.put('/product/:id/favorite/add', (req, res) => {
    addFavorite(req, res)
})

router.put('/product/:id/favorite/remove', (req, res) => {
    removeFavorite(req, res)
})


module.exports = router