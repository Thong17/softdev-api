const router = require('express').Router()
const { listSale, totalSale, topProduct, topStaff, listProduct, listStaff } = require('../../controllers/reportController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/listSale', security.role(privilege.report.sale), (req, res) => {
    listSale(req, res)
})

router.get('/totalSale', security.role(privilege.report.sale), (req, res) => {
    totalSale(req, res)
})

router.get('/topProduct', security.role(privilege.report.product), (req, res) => {
    topProduct(req, res)
})

router.get('/topStaff', security.role(privilege.report.product), (req, res) => {
    topStaff(req, res)
})

router.get('/listStaff', security.role(privilege.report.staff), (req, res) => {
    listStaff(req, res)
})

router.get('/listProduct', security.role(privilege.report.staff), (req, res) => {
    listProduct(req, res)
})

module.exports = router