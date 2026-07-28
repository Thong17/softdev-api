const router = require('express').Router()
const { clearTransactionAndPayment } = require('../../controllers/utilityController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')
const { dumpMongoDB } = require('../../controllers/utilityController')

router.delete('/clear-payment', security.requireStore, security.role(privilege.payment.delete), (req, res) => {
    clearTransactionAndPayment(req, res)
})

router.post('/backup-db', async (req, res) => {
    dumpMongoDB(req, res)
})

module.exports = router