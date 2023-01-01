const Drawer = require('../models/Drawer')
const Payment = require('../models/Payment')
const Transaction = require('../models/Transaction')
const StoreSetting = require('../models/StoreSetting')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, calculatePaymentTotal, calculateReturnCashes, sendMessageTelegram, currencyFormat } = require('../helpers/utils')
const { createPaymentValidation, checkoutPaymentValidation } = require('../middleware/validations/paymentValidation')
const Reservation = require('../models/Reservation')
const Customer = require('../models/Customer')
const moment = require('moment')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'desc'
    
    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }
    
    Payment.find({ ...query }, async (err, payments) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Payment.count()
        return response.success(200, { data: payments, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('createdBy')
}

exports.detail = async (req, res) => {
    Payment.findById(req.params.id, (err, payment) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: payment }, res)
    }).populate('createdBy').populate('customer', 'displayName point').populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createPaymentValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    if (!req.user.drawer) return response.failure(422, { msg: 'Open drawer first!' }, res)

    try {
        const countPayment = await Payment.count()
        const invoice = 'INV' + countPayment.toString().padStart(5, '0')
        const buyRate = req.user.drawer.buyRate
        const sellRate = req.user.drawer.sellRate

        const transactions = await Transaction.find({ _id: { '$in': body.transactions } })
        const { total, subtotal, rate } = calculatePaymentTotal(transactions, body.services, body.vouchers, body.discounts, { buyRate, sellRate })

        const mappedBody = {
            ...body,
            total,
            subtotal,
            rate,
            invoice,
            drawer: req.user.drawer?._id,
            createdBy: req.user.id,
            customer: body.customer
        }

        Payment.create(mappedBody, async (err, payment) => {
            if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
            if (!payment) return response.failure(422, { msg: 'No payment created!' }, res, err)

            let data = await payment.populate('customer')
            data = await payment.populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } })
            data = await payment.populate('createdBy', 'username')
            response.success(200, { msg: 'Payment has created successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body

    try {
        const id = req.params.id
        let data = await Payment.findByIdAndUpdate(id, body, { new: true })
        if (data.status) return response.failure(422, { msg: 'Payment has already completed' }, res)

        const listTransactions = data?.transactions
        if (body.transaction) listTransactions.push(body.transaction.id)
        
        const transactions = await Transaction.find({ _id: { '$in': listTransactions } })
        const { total, subtotal } = calculatePaymentTotal(transactions, data.services, data.vouchers, data.discounts, data.rate)

        data.total = total
        data.subtotal = subtotal
        data.transactions = listTransactions
        data.save()
        data = await data.populate('customer')
        data = await data.populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } })
        data = await data.populate('createdBy', 'username')
        response.success(200, { msg: 'Payment has updated successfully', data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.checkout = async (req, res) => {
    const body = req.body
    const { error } = checkoutPaymentValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const id = req.params.id
        const payment = await Payment.findById(id).populate('drawer').populate('transactions')
        if (payment.status) return response.failure(422, { msg: 'Payment has already checked out' }, res)

        calculateReturnCashes(payment?.drawer?.cashes, body.remainTotal, payment.rate)
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(payment?.drawer?._id, { cashes })
                const data = await Payment.findByIdAndUpdate(id, { ...body, returnCashes, status: true }, { new: true }).populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } }).populate('customer').populate('createdBy', 'username')
                
                for (let i = 0; i < data.transactions.length; i++) {
                    const transaction = data.transactions[i]
                    await Transaction.findByIdAndUpdate(transaction, { status: true })
                }

                if (data.reservation) await Reservation.findByIdAndUpdate(data.reservation, { isCompleted: true })
                if (data.customer) {
                    const customer = await Customer.findById(data.customer)
                    const paymentPoint = payment.total.currency === 'USD' ? payment.total.value : payment.total.value / payment.rate.buyRate
                    customer.point = customer.point + paymentPoint
                    customer.save()
                }

                // Send message to Telegram
                const storeConfig = await StoreSetting.findOne()
                if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_PAYMENT) {
                    const text = `New Payment On ${moment(data.createdAt).format('YYYY-MM-DD')}
                        🧾Invoice: ${data.invoice}
                        💵Subtotal: ${currencyFormat(data.subtotal.BOTH)} USD
                        💵Total: ${currencyFormat(data.total.value)} ${data.total.currency}
                        👝Payment Method: ${data.paymentMethod || 'cash'}
                        👱‍♂️By: ${req.user?.username}
                        `
                    sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                        .catch(err => console.error(err))
                }
                
                response.success(200, { msg: 'Payment has checked out successfully', data }, res)
            })
            .catch(err => response.failure(err.code, { msg: err.msg }, res, err))

    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const payments = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: payments }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const payments = req.body

        payments.forEach(payment => {
            payment.name = JSON.parse(payment.name)
            payment.icon = JSON.parse(payment.icon)
        })

        Payment.insertMany(payments)
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

