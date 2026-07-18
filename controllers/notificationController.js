const Notification = require('../models/Notification')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const cron = require('node-cron')
const ProductStock = require('../models/ProductStock')

exports.list = async (req, res) => {
    const scope = {
        company: req.tenant?.companyId || req.body?.company || req.query?.company,
        store: req.tenant?.storeId || req.body?.store || req.query?.store,
    }

    Notification.find({ isRead: false, ...scope }, (err, notifications) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: notifications }, res)
    }).select('title description type isRead isPopup stock').populate('stock')
}

exports.count = async (req, res) => {
    const scope = {
        company: req.tenant?.companyId || req.body?.company || req.query?.company,
        store: req.tenant?.storeId || req.body?.store || req.query?.store,
    }

    Notification.count({ isRead: false, ...scope }, (err, count) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: count }, res)
    })
}

cron.schedule('0 9 * * 1', async () => {
    try {
        const outOfStock = await ProductStock.find({ $expr: { $lte: ['$quantity', '$alertAt'] } }).populate('product')
        const expireSoon = await ProductStock.find({ expireAt: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }).populate('product')
        
        const notifications = []
        outOfStock.forEach(stock => {
            notifications.push(new Notification({
                title: `Product out of stock: ${stock.product.name?.English}`,
                description: `Product ${stock.product.name?.English} only has ${stock.quantity} items left in stock`,
                type: 'OUT_OF_STOCK',
                stock: stock._id
            }))
        })
        expireSoon.forEach(stock => {
            notifications.push(new Notification({
                title: `Product ${stock.product.name?.English} is expiring soon`,
                description: `Product ${stock.product.name?.English} will expire on ${stock.expireAt.toLocaleDateString()}.`,
                type: 'EXPIRE',
                stock: stock._id
            }))
        })

        console.log(notifications)
        
        await Notification.insertMany(notifications)
    } catch (err) {
        console.error('Error creating notifications:', err)
    }
})