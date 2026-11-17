const router = require('express').Router()
const { clearTransactionAndPayment } = require('../../controllers/utilityController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')
const { dumpMongoDB, downloadBackup, resetOptions, resetData, backupList, restoreFromServer, restoreFromUpload } = require('../../controllers/utilityController')
const response = require('../../helpers/response')
const { isSuperAdmin } = require('../../helpers/superAdmin')

// Backups and resets touch the whole database, so only Super Admins may use them
const superAdminOnly = (req, res, next) => {
    if (!isSuperAdmin(req.user)) return response.failure(403, { msg: 'Only a Super Admin can do this' }, res)
    next()
}

router.delete('/clear-payment', security.role(privilege.payment.delete), (req, res) => {
    clearTransactionAndPayment(req, res)
})

router.post('/backup-db', superAdminOnly, async (req, res) => {
    dumpMongoDB(req, res)
})

router.get('/backup-download', superAdminOnly, downloadBackup)

router.get('/reset-options', superAdminOnly, resetOptions)

router.post('/reset', superAdminOnly, resetData)

router.get('/backups', superAdminOnly, backupList)

router.post('/restore', superAdminOnly, restoreFromServer)

// The backup file is the raw body (application/octet-stream)
router.post('/restore-upload', superAdminOnly, restoreFromUpload)

module.exports = router