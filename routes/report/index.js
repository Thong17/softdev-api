const router = require('express').Router()
const { sale } = require('../../controllers/reportController')
const security = require('../../middleware/security')
const { privilege } = require('../../constants/roleMap')

router.get('/sale', security.role(privilege.report.sale), (req, res) => {
    sale(req, res)
})

module.exports = router