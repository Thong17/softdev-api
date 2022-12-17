const Drawer = require('../models/Drawer')
const StoreSetting = require('../models/StoreSetting')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, sendMessageTelegram, currencyFormat } = require('../helpers/utils')
const { createDrawerValidation } = require('../middleware/validations/drawerValidation')
const User = require('../models/User')
const moment = require('moment')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'
    
    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }
    
    Drawer.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Drawer.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
}

exports.list = async (req, res) => {
    Drawer.find({ isDeleted: false }, (err, drawers) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: drawers }, res)
    }).select('name tags')
}

exports.detail = async (req, res) => {
    Drawer.findById(req.params.id, (err, drawer) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: drawer }, res)
    })
}

exports.open = async (req, res) => {
    const body = req.body
    const { error } = createDrawerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Drawer.create({ ...body, user: req.user._id }, async (err, drawer) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Drawer already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }
            if (!drawer) return response.failure(422, { msg: 'No drawer created!' }, res, err)

            // Send message to Telegram
            const storeConfig = await StoreSetting.findOne()
            if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_OPEN_DRAWER) {
                let totalCashUSD = 0
                let totalCashKHR = 0
                drawer.cashes?.forEach(cash => {
                    if (cash.currency === 'USD') {
                        totalCashUSD += cash.total
                    } else {
                        totalCashKHR += cash.total
                    }
                })
                const text = `✅Open Drawer On ${moment(drawer.createdAt).format('YYYY-MM-DD')}
                    💵Buy Rate: ${currencyFormat(drawer.buyRate)}
                    💵Sell Rate: ${currencyFormat(drawer.sellRate)}
                    💰Total USD: ${currencyFormat(totalCashUSD)} USD
                    💰Total KHR: ${currencyFormat(totalCashKHR)} KHR
                    👱‍♂️By: ${req.user?.username}
                    `
                sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                    .catch(err => console.error(err))
            }

            response.success(200, { msg: 'Drawer has created successfully', data: drawer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.save = async (req, res) => {
    const body = req.body
    const { error } = createDrawerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Drawer.findByIdAndUpdate(req.params.id, body, async (err, drawer) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!drawer) return response.failure(422, { msg: 'No drawer updated!' }, res, err)

            // Send message to Telegram
            const storeConfig = await StoreSetting.findOne()
            if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_OPEN_DRAWER) {
                let totalCashUSD = 0
                let totalCashKHR = 0
                drawer.cashes?.forEach(cash => {
                    const totalRemain = parseFloat(cash.cash) * cash.quantity
                    if (cash.currency === 'USD') {
                        totalCashUSD += totalRemain
                    } else {
                        totalCashKHR += totalRemain
                    }
                })
                const text = `❕Update Drawer On ${moment(drawer.endedAt).format('YYYY-MM-DD')}
                    💵Buy Rate: ${currencyFormat(drawer.buyRate)}
                    💵Sell Rate: ${currencyFormat(drawer.sellRate)}
                    💰Total USD: ${currencyFormat(totalCashUSD)} USD
                    💰Total KHR: ${currencyFormat(totalCashKHR)} KHR
                    👱‍♂️By: ${req.user?.username}
                    `
                sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                    .catch(err => console.error(err))
            }

            response.success(200, { msg: 'Drawer has updated successfully', data: drawer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.close = async (req, res) => {
    try {
        Drawer.findByIdAndUpdate(req.params.id, { status: false, endedAt: Date.now() }, async (err, drawer) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            await User.findByIdAndUpdate(drawer.user, { drawer: null })
            if (!drawer) return response.failure(422, { msg: 'No drawer updated!' }, res, err)

            // Send message to Telegram
            const storeConfig = await StoreSetting.findOne()
            if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_CLOSE_DRAWER) {
                let totalCashUSD = 0
                let totalCashKHR = 0
                drawer.cashes?.forEach(cash => {
                    const totalRemain = parseFloat(cash.cash) * cash.quantity
                    if (cash.currency === 'USD') {
                        totalCashUSD += totalRemain
                    } else {
                        totalCashKHR += totalRemain
                    }
                })
                const text = `⛔️Close Drawer On ${moment(drawer.endedAt).format('YYYY-MM-DD')}
                    💵Buy Rate: ${currencyFormat(drawer.buyRate)}
                    💵Sell Rate: ${currencyFormat(drawer.sellRate)}
                    💰Total USD: ${currencyFormat(totalCashUSD)} USD
                    💰Total KHR: ${currencyFormat(totalCashKHR)} KHR
                    👱‍♂️By: ${req.user?.username}
                    `
                sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                    .catch(err => console.error(err))
            }

            response.success(200, { msg: 'Drawer has updated successfully', data: drawer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const drawers = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: drawers }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const drawers = req.body

        drawers.forEach(drawer => {
            drawer.name = JSON.parse(drawer.name)
            drawer.icon = JSON.parse(drawer.icon)
        })

        Drawer.insertMany(drawers)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'branches' : 'branch'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

