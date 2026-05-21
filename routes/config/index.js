const router = require('express').Router()
const { signQzCert, getCertificate } = require('../../controllers/configController')

router.post('/sign-qz-cert', (req, res) => {
    signQzCert(req, res)
})

router.post('/get-certificate', (req, res) => {
    getCertificate(req, res)
})

module.exports = router