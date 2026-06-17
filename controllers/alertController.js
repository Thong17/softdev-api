const ProductStock = require('../models/ProductStock')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

exports.getNotification = async (req, res) => {
    const limit = Number.parseInt(req.query.limit) || 10
    const page = Number.parseInt(req.query.page) || 0

    try {
        const candidates = await ProductStock.find({
            alertAt: { $gt: 0 },
            expireAt: { $exists: true, $ne: null }
        })
            .populate({ path: 'product', populate: { path: 'images' } })
            .skip(page * limit)
            .limit(limit)

        const now = new Date()

        const notifications = candidates.filter(stock => {
            if (!stock.expireAt || !stock.alertAt) return false
            const alertMs = Number(stock.alertAt) * 24 * 60 * 60 * 1000
            const alertThreshold = new Date(stock.expireAt.getTime() - alertMs)
            return now >= alertThreshold
        })

        return response.success(200, { data: notifications }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

