const Drawer = require('../models/Drawer')
const Payment = require('../models/Payment')
const Transaction = require('../models/Transaction')
const StoreSetting = require('../models/StoreSetting')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, calculatePaymentTotal, calculateReturnCashes, sendMessageTelegram, currencyFormat, generateInvoice } = require('../helpers/utils')
const utils = require('../helpers/utils')
const { createPaymentValidation, checkoutPaymentValidation } = require('../middleware/validations/paymentValidation')
const Reservation = require('../models/Reservation')
const Customer = require('../models/Customer')
const moment = require('moment')
const { telegramReceiptTemplate } = require('./utilityController')
const GroupPayment = require('../models/GroupPayment')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'desc'
    const fromDate = req.query.fromDate
    const toDate = req.query.toDate
    const state = req.query.state
    
    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }

    if (state) {
        query.state = state
    }
    
    // Add date filtering if fromDate and/or toDate are provided
    if (fromDate || toDate) {
        query.createdAt = {}
        if (fromDate) {
            const fromDateObj = moment(fromDate, 'YYYY-MM-DD').startOf('day').toDate()
            if (moment(fromDateObj).isValid()) {
                query.createdAt.$gte = fromDateObj
            }
        }
        if (toDate) {
            const toDateObj = moment(toDate, 'YYYY-MM-DD').endOf('day').toDate()
            if (moment(toDateObj).isValid()) {
                query.createdAt.$lte = toDateObj
            }
        }
    }
    
    Payment.find({ ...query }, async (err, payments) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Payment.count({ ...query })
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
    }).populate('createdBy').populate({ path: 'reservation', populate: 'structures' }).populate('customer', 'displayName point').populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createPaymentValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    if (!req.user.drawer) return response.failure(422, { msg: 'Open drawer first!' }, res)

    try {
        const invoice = await generateInvoice(Payment)
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
            data = await payment.populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
            data = await payment.populate('createdBy', 'username')
            data = await payment.populate({ path: 'reservation', populate: 'structures' })
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
        
        const transactions = await Transaction.find({ _id: { '$in': listTransactions }, isDeleted: false })
        const { total, subtotal } = calculatePaymentTotal(transactions, data.services, data.vouchers, data.discounts, data.rate)

        data.total = total
        data.subtotal = subtotal
        data.transactions = listTransactions
        data.save()
        data = await data.populate('customer')
        data = await data.populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
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
        const payment = await Payment.findById(id).populate('drawer').populate({ path: 'transactions', match: { isDeleted: false }})
        if (payment.status) return response.failure(422, { msg: 'Payment has already checked out' }, res)

        calculateReturnCashes(payment?.drawer?.cashes, body.remainTotal, payment.rate)
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(payment?.drawer?._id, { cashes })
                const data = await Payment.findByIdAndUpdate(id, { ...body, returnCashes, status: true, state: 'COMPLETED' }, { new: true })
                    .populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
                    .populate('customer').populate('createdBy', 'username')
                
                for (let i = 0; i < data.transactions.length; i++) {
                    const transaction = data.transactions[i]
                    await Transaction.findByIdAndUpdate(transaction, { status: true, state: 'COMPLETED' })
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
                    const text = await telegramReceiptTemplate(data)
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

exports.groupPayment = async (req, res) => {
    try {
        const { paymentIds } = req.body
        const payments = await Payment.find({ _id: { $in: paymentIds } }).populate('customer').populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] }).populate('createdBy', 'username').populate({ path: 'reservation', populate: 'structures' })
        // determine group rate (prefer checkoutFields.rate, fallback to first payment rate)
        const buyRate = req.user.drawer.buyRate
        const sellRate = req.user.drawer.sellRate
        const groupRate = { buyRate, sellRate }

        // aggregate total in USD using groupRate
        let totalUSD = 0
        let subtotalUSD = 0
        let subtotalKHR = 0
        let subtotalBOTH = 0
        for (const p of payments) {
            subtotalKHR += p.subtotal.KHR
            subtotalUSD += p.subtotal.USD
            subtotalBOTH += p.subtotal.BOTH
            if (!p.total) continue
            if (p.total.currency === 'USD') totalUSD += p.total.value
            else totalUSD += p.total.value / (groupRate.sellRate || 4000)
        }

        const groupBody = {
            invoice: null,
            total: { value: totalUSD, currency: 'USD' },
            subtotal: { USD: subtotalUSD, KHR: subtotalKHR, BOTH: subtotalBOTH },
            rate: groupRate,
            payments: paymentIds,
            createdBy: req.user
        }
        response.success(200, { data: payments, group: groupBody }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.groupCheckout = async (req, res) => {
    const { checkoutFields, paymentIds } = req.body

    if (!checkoutFields) return response.failure(422, { msg: 'checkoutFields is required' }, res)
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) return response.failure(422, { msg: 'paymentIds must be a non-empty array' }, res)

    const { error } = checkoutPaymentValidation.validate(checkoutFields, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        // load payments
        const payments = await Payment.find({ _id: { $in: paymentIds } }).populate('drawer').populate({ path: 'transactions', match: { isDeleted: false }})

        // ensure none already checked out
        const already = payments.find(p => p.status)
        if (already) return response.failure(422, { msg: 'One or more payments have already checked out' }, res)

        // create group payment record
        const invoice = await generateInvoice(GroupPayment, new Date(), 'GRP')
        // determine group rate (prefer checkoutFields.rate, fallback to first payment rate)
        const buyRate = req.user.drawer.buyRate
        const sellRate = req.user.drawer.sellRate
        const groupRate = { buyRate, sellRate }

        // aggregate total in USD using groupRate
        let totalUSD = 0
        let subtotalUSD = 0
        let subtotalKHR = 0
        let subtotalBOTH = 0
        for (const p of payments) {
            subtotalKHR += p.subtotal.KHR
            subtotalUSD += p.subtotal.USD
            subtotalBOTH += p.subtotal.BOTH
            if (!p.total) continue
            if (p.total.currency === 'USD') totalUSD += p.total.value
            else totalUSD += p.total.value / (groupRate.sellRate || 4000)
        }

        const { cashes, returnCashes } = await calculateReturnCashes(req.user.drawer?.cashes || [], checkoutFields.remainTotal, groupRate)

        const groupBody = {
            invoice,
            total: { value: totalUSD, currency: 'USD' },
            subtotal: { USD: subtotalUSD, KHR: subtotalKHR, BOTH: subtotalBOTH },
            rate: groupRate,
            payments: paymentIds,
            remainTotal: checkoutFields.remainTotal,
            receiveCashes: checkoutFields.receiveCashes,
            receiveTotal: checkoutFields.receiveTotal,
            returnCashes,
            paymentMethod: checkoutFields.paymentMethod || 'cash',
            createdBy: req.user.id,
            drawer: req.user.drawer?._id,
        }

        const group = await GroupPayment.create(groupBody)

        // maintain drawer cashes map
        const updatedPayments = []

        for (const p of payments) {
            const id = p._id.toString()

            // calculate return cashes for this payment using group remainTotal and groupRate
            // eslint-disable-next-line no-await-in-loop
            const updateBody = { ...checkoutFields, status: true, state: 'COMPLETED', groupPayment: group._id }

            // eslint-disable-next-line no-await-in-loop
            let data = await Payment.findByIdAndUpdate(id, updateBody, { new: true })
                .populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
                .populate('customer').populate('createdBy', 'username')

            // mark transactions completed
            // eslint-disable-next-line no-await-in-loop
            await utils.checkoutTransaction({ transactions: data.transactions })

            if (data.reservation) await Reservation.findByIdAndUpdate(data.reservation, { isCompleted: true })
            if (data.customer) {
                const paymentPoint = data.total.currency === 'USD' ? data.total.value : data.total.value / data.rate.buyRate
                // eslint-disable-next-line no-await-in-loop
                await utils.calculateCustomerPoint({ customerId: data.customer, paymentPoint })
            }

            // send telegram per payment if enabled
            const storeConfig = await StoreSetting.findOne()
            if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_PAYMENT) {
                const text = await telegramReceiptTemplate(data)
                sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                    .catch(err => console.error(err))
            }

            updatedPayments.push(data)
        }

        // update group status
        group.status = true
        group.state = 'COMPLETED'
        group.transactions = updatedPayments.flatMap(p => p.transactions || [])
        await group.save()

        await Drawer.findByIdAndUpdate(group?.drawer?._id, { cashes })

        response.success(200, { msg: 'Group checkout completed successfully', data: updatedPayments, group }, res)
    } catch (err) {
        return response.failure(422, { msg: err?.msg ?? failureMsg.trouble }, res, err)
    }
}

