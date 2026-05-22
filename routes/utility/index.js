const router = require('express').Router()
const { clearTransactionAndPayment } = require('../../controllers/utilityController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.delete('/clear-payment', security.role(privilege.payment.delete), (req, res) => {
    clearTransactionAndPayment(req, res)
})

module.exports = router