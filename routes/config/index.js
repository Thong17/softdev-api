const router = require('express').Router()
const { signQzCert } = require('../../controllers/configController')

router.post('/sign-qz-cert', (req, res) => {
    signQzCert(req, res)
})

module.exports = router