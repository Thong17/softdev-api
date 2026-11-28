const router = require('express').Router()
const { listSale, totalSale, totalSaleBreakdown, totalSaleBreakdownRows, totalSaleBreakdownItems, topProduct, topStaff, listProduct, listStaff } = require('../../controllers/reportController')
const reportExport = require('../../controllers/reportExportController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/listSale', security.role(privilege.report.sale), (req, res) => {
    listSale(req, res)
})

router.get('/totalSale', security.role(privilege.report.sale), (req, res) => {
    totalSale(req, res)
})

// How the Income or Profit card is worked out: each source's totals for the
// card's period (?type=income|profit) or a date-time range (fromDate, toDate)
router.get('/totalSale/breakdown', security.role(privilege.report.sale), (req, res) => {
    totalSaleBreakdown(req, res)
})

// One page of the sales and payments (?source=all|sales|loan|clearance|payLater)
router.get('/totalSale/breakdown/rows', security.role(privilege.report.sale), (req, res) => {
    totalSaleBreakdownRows(req, res)
})

// The items behind one row, with their costs (?source=...&id=<row id>)
router.get('/totalSale/breakdown/items', security.role(privilege.report.sale), (req, res) => {
    totalSaleBreakdownItems(req, res)
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