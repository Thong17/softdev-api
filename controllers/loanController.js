const Loan = require('../models/Loan')
const LoanPayment = require('../models/LoanPayment')
const Drawer = require('../models/Drawer')
const Payment = require('../models/Payment')
const StoreSetting = require('../models/StoreSetting')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { checkoutTransaction, calculateCustomerPoint, sendMessageTelegram, generateLoanPayment, extractJoiErrors, calculateReturnCashes } = require('../helpers/utils')
const { checkoutLoanValidation } = require('../middleware/validations/loanValidation')

const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads')
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`)
    },
})
const uploadFiles = multer({
    storage,
    limits: { fileSize: 10 * 1000 * 1000 },
  }).array('attachment', 10)

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
    
    Loan.find({ isDeleted: false, status: 'APPROVED', ...query }, async (err, loans) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Loan.count({ isDeleted: false })
        return response.success(200, { data: loans, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('payment customer')
}

exports.listRequest = async (req, res) => {
    try {
        const filter = req.query.filter || 'createdAt'
        const sort = req.query.sort || 'desc'
        let filterObj = { [filter]: sort }
        
        const loans = await Loan.find({ isDeleted: false, status: 'PENDING' }).sort(filterObj).populate('payment customer')
        return response.success(200, { data: loans }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    Loan.findById(req.params.id, (err, loan) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: loan }, res)
    }).populate('payment customer loanPayments')
}

exports.cancel = async (req, res) => {
    try {
        await Loan.findByIdAndUpdate(req.params.id, { isDeleted: true })
        return response.success(200, { msg: 'Loan has been canceled' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.reject = async (req, res) => {
    try {
        await Loan.findByIdAndUpdate(req.params.id, { status: 'REJECTED' })
        return response.success(200, { msg: 'Loan has been rejected' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.approve = async (req, res) => {
    try {
        await Loan.findByIdAndUpdate(req.params.id, { status: 'APPROVED' })
        return response.success(200, { msg: 'Loan has been approved' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.approveAll = async (req, res) => {
    try {
        const loans = await Loan.updateMany({ status: 'PENDING' }, { status: 'APPROVED' })
        return response.success(200, { msg: `${loans} ${loans.length > 1 ? 'loans' : 'loan'} has been approved` }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.create = async (req, res) => {
    uploadFiles(req, res, async (err) => {
        if (err) return response.failure(422, { msg: err.message }, res, err)
        try {
            const body = {}
            Object.keys(req.body).forEach(item => {
                if (item === 'attachment') return
                body[item] = JSON.parse(req.body[item])
            })
            const files = req.files.map(file => ({ filename: file.filename }))
            const payment = await Payment.findById(body?.payment).populate('drawer').populate('transactions')
            if (payment.status) return response.failure(422, { msg: 'Payment has already checked out' }, res)
            if (body.totalRemain.USD <= 0) return response.failure(422, { msg: 'No balance to proceed loan' }, res)

            const { listPayment, loanId } = await generateLoanPayment({...body, createdBy: req.user.id})

            const loanBody = {
                ...body, 
                totalPaid: { value: body.totalPaid.total, currency: 'USD' }, 
                totalLoan: body.totalRemain, 
                loanPayments: listPayment, 
                attachments: files, 
                createdBy: req.user.id
            }
            const loan = await Loan.create({_id: loanId, ...loanBody})
            if (!loan) return response.failure(422, { msg: 'No loan created!' }, res)
            const paymentMethod = 'loan'
            const data = await Payment.findByIdAndUpdate(body?.payment, { ...body, paymentMethod, status: true }, { new: true }).populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } }).populate('customer').populate('createdBy', 'username')
            
            if (data.customer) {
                const paymentPoint = payment.total.currency === 'USD' ? payment.total.value : payment.total.value / payment.rate.buyRate
                calculateCustomerPoint({ customerId: data.customer, paymentPoint })
                    .catch(err => console.error(err))
            }
            checkoutTransaction({ transactions: data.transactions })
                .then((message) => console.info(message))
                .catch(err => console.error(err))

            // Send message to Telegram
            const storeConfig = await StoreSetting.findOne()
            if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_PAYMENT) {
                const text = `New Payment On ${moment(data.createdAt).format('YYYY-MM-DD')}
                    🧾Invoice: ${data.invoice}
                    💵Subtotal: ${currencyFormat(data.subtotal.BOTH)} USD
                    💵Total: ${currencyFormat(data.total.value)} ${data.total.currency}
                    👝Payment Method: ${paymentMethod}
                    👱‍♂️By: ${req.user?.username}
                    `
                sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                    .catch(err => console.error(err))
            }
            
            response.success(200, { msg: 'Loan has checked out successfully', data }, res)
        } catch (err) {
            return response.failure(422, { msg: failureMsg.trouble }, res, err)
        }
    })
}

exports.payment = async (req, res) => {
    const body = req.body
    const { error } = checkoutLoanValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const id = req.params.id
        const loanPayment = await LoanPayment.findById(id)
        if (loanPayment.isPaid || loanPayment.isDeleted) return response.failure(422, { msg: 'Loan has already completed' }, res)

        const drawer = req.user?.drawer
        if (!drawer) return response.failure(422, { msg: 'No drawer opened' }, res)

        calculateReturnCashes(drawer?.cashes, body.remainTotal, { sellRate: drawer.sellRate, buyRate: drawer.buyRate })
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(drawer?._id, { cashes })
                const data = await LoanPayment.findByIdAndUpdate(id, { ...body, returnCashes, isPaid: true }, { new: true }).populate('createdBy', 'username')

                const loan = await Loan.findById(data.loan)
                const totalUSD = body.total.value

                loan.actualPaid = {
                    value: loan.actualPaid.value + data.principalAmount.value,
                    currency: 'USD',
                }
                loan.totalPaid = {
                    value: loan.totalPaid.value + totalUSD,
                    currency: 'USD',
                }

                const totalRemain = loan.totalRemain.USD - data.principalAmount.value
                loan.totalRemain = {
                    USD: totalRemain,
                    KHR: totalRemain * drawer.sellRate,
                }
                await loan.save()

                // Send message to Telegram
                const storeConfig = await StoreSetting.findOne()
                if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_PAYMENT) {
                    const text = `Loan Payment On ${moment(data.createdAt).format('YYYY-MM-DD')}
                        🧾Invoice: ${data.invoice}
                        💵Subtotal: ${currencyFormat(data.subtotal.BOTH)} USD
                        💵Total: ${currencyFormat(data.total.value)} ${data.total.currency}
                        👝Payment Method: ${data.paymentMethod || 'cash'}
                        👱‍♂️By: ${req.user?.username}
                        `
                    sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                        .catch(err => console.error(err))
                }
                
                response.success(200, { msg: 'Loan Payment has checked out successfully', data }, res)
            })
            .catch(err => response.failure(err.code, { msg: err.msg }, res, err))
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.checkout = async (req, res) => {
    const body = req.body
    const { error } = checkoutLoanValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const id = req.params.id
        const loan = await Loan.findById(id)
        if (loan.status === 'COMPLETED') return response.failure(422, { msg: 'Loan has already paid' }, res)

        const drawer = req.user?.drawer
        if (!drawer) return response.failure(422, { msg: 'No drawer opened' }, res)

        calculateReturnCashes(drawer.cashes, body.remainTotal, { sellRate: drawer.sellRate, buyRate: drawer.buyRate })
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(drawer?._id, { cashes })
                const data = await Loan.findByIdAndUpdate(id, {
                        paymentObj: {
                            ...body,
                            returnCashes
                        },
                        totalRemain: body.remainTotal,
                        status: 'CLEARED'
                    }, 
                    { new: true }
                )
                    .populate('customer payment loanPayments').populate('createdBy', 'username')

                for (let i = 0; i < data?.loanPayments.length; i++) {
                    const loanPayment = data?.loanPayments[i]
                    await LoanPayment.findByIdAndUpdate(loanPayment, { isPaid: true })
                }

                // Send message to Telegram
                const storeConfig = await StoreSetting.findOne()
                if (storeConfig && storeConfig.telegramPrivilege?.SENT_AFTER_PAYMENT) {
                    const text = `Clear Loan On ${moment(data.createdAt).format('YYYY-MM-DD')}
                        🧾Invoice: ${data.payment.invoice}
                        👝Payment Method: ${body.paymentMethod || 'cash'}
                        👱‍♂️By: ${req.user?.username}
                        `
                    sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
                        .catch(err => console.error(err))
                }
                const responseData = {
                    status: true,
                    loanPayments: data.loanPayments,
                    ...data.paymentObj
                }
                response.success(200, { msg: 'Loan has been cleared successfully', data: responseData }, res)
            })
            .catch(err => response.failure(err.code, { msg: err.msg }, res, err))

    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
