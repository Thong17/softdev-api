const Notification = require('../models/Notification')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

exports.list = async (req, res) => {
    Notification.find({ isRead: false }, (err, notifications) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: notifications }, res)
    }).select('title description type isRead isPopup stock').populate('stock')
}

exports.count = async (req, res) => {
    Notification.count({ isRead: false }, (err, count) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: count }, res)
    })
}

// The weekly job that stored stock notifications here was removed: the bell
// works them out live (alertController.getNotification) and never read these
// rows, which piled up as duplicates every Monday.