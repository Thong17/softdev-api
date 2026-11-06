const router = require('express').Router()
const { status, certificate, sign, label, receipt, groupReceipt } = require('../../controllers/printController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/status', security.role(privilege.payment.detail), (req, res) => {
    status(req, res)
})

// Printing only needs a logged-in user (it is part of checkout for any cashier),
// matching the old browser printing which had no privilege check.

// QZ Tray certificate/signature for the browser in `web` print mode
router.get('/certificate', (req, res) => {
    certificate(req, res)
})

router.post('/sign', (req, res) => {
    sign(req, res)
})

router.post('/label', (req, res) => {
    label(req, res)
})

router.post('/receipt', (req, res) => {
    receipt(req, res)
})

router.post('/group-receipt', (req, res) => {
    groupReceipt(req, res)
})

module.exports = router
