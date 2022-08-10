const router = require('express').Router()
const { profile, changeTheme, changeLanguage, addFavorite, removeFavorite } = require('../../controllers/userController')

router.get('/profile', (req, res) => {
    profile(req, res)
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