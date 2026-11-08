const router = require('express').Router()
const { listSale, totalSale, topProduct, topStaff, listProduct, listStaff } = require('../../controllers/reportController')
const reportExport = require('../../controllers/reportExportController')
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

// Excel exports of the reports (inventory shares the product report privilege)
router.get('/export/sale', security.role(privilege.report.sale), (req, res) => {
    reportExport.sale(req, res)
})

router.get('/export/product', security.role(privilege.report.product), (req, res) => {
    reportExport.product(req, res)
})

router.get('/export/staff', security.role(privilege.report.staff), (req, res) => {
    reportExport.staff(req, res)
})

router.get('/export/inventory', security.role(privilege.report.product), (req, res) => {
    reportExport.inventory(req, res)
})

module.exports = router