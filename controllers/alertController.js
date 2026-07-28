const ProductStock = require('../models/ProductStock')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const moment = require('moment')

exports.getNotification = async (req, res) => {
    const limit = Number.parseInt(req.query.limit) || 10
    const page = Number.parseInt(req.query.page) || 0

    try {
        const candidates = await ProductStock.find({
            store: req.store,
            quantity: { $gt: 0 },
            $or: [
                { alertAt: { $gt: 0 } },
                { expireAt: { $exists: true, $ne: null } }
            ]
        })
            .populate({ path: 'product', populate: { path: 'images' } })
            .skip(page * limit)
            .limit(limit)

        

        const notifications = candidates.filter(stock => {
            if (stock?.quantity <= 0) return false
            let condition = false
            if (stock.expireAt) {
                let x = moment(new Date(stock.expireAt))
                let y = moment(Date.now())
                const duration = moment.duration(x.diff(y))
                
                const durationDays = duration.asDays()
                condition = durationDays < 10
            }
            if (stock.alertAt) {
                condition = stock.quantity < stock.alertAt
            }
            return condition
        })

        return response.success(200, { data: notifications?.map(item => ({...item._doc, type: 'stock'})) }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

