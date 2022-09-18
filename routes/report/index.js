const router = require('express').Router()
const { sale, product, staff } = require('../../controllers/reportController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/sale', security.role(privilege.report.sale), (req, res) => {
    sale(req, res)
})

router.get('/product', security.role(privilege.report.product), (req, res) => {
    product(req, res)
})

router.get('/staff', security.role(privilege.report.staff), (req, res) => {
    staff(req, res)
})

module.exports = router