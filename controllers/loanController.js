const Loan = require('../models/Loan')
const LoanPayment = require('../models/LoanPayment')
const Drawer = require('../models/Drawer')
const Payment = require('../models/Payment')
const StoreSetting = require('../models/StoreSetting')
const ProductStock = require('../models/ProductStock')
const TransactionClearance = require('../models/TransactionClearance')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { checkoutTransaction, calculateCustomerPoint, sendMessageTelegram, generateLoanPayment, extractJoiErrors, calculateReturnCashes, reverseProductStock, generateLoanPreview } = require('../helpers/utils')
const { checkoutLoanValidation, loanWriteOffValidation } = require('../middleware/validations/loanValidation')
const { sendTelegram } = require('./utilityController')
const uuid = require('uuid').v4
const mongoose = require('mongoose');

const multer = require('multer')
const Transaction = require('../models/Transaction')
const Product = require('../models/Product')
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
    
    Loan.find({ isDeleted: false, status: { $ne: 'PENDING' }, store: req.store, ...query }, async (err, loans) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        const listLoans = loans.map(item => {
            return {
                ...item._doc,
                dueDate: item.loanPayments && item.loanPayments.length > 0 ? item.loanPayments.find(lp => !lp.isPaid)?.dueDate : null
            }
        })

        const totalCount = await Loan.count({ isDeleted: false, store: req.store })
        return response.success(200, { data: listLoans, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('payment customer loanPayments')
}

exports.listRequest = async (req, res) => {
    try {
        const filter = req.query.filter || 'createdAt'
        const sort = req.query.sort || 'desc'
        let filterObj = { [filter]: sort }
        
        const loans = await Loan.find({ isDeleted: false, status: 'PENDING', store: req.store }).sort(filterObj).populate('payment customer')
        return response.success(200, { data: loans }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    Loan.findOne({ _id: req.params.id, store: req.store }, (err, loan) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: loan }, res)
    }).populate('customer loanPayments').populate({ path: 'payment', populate: { path: 'transactions' } })
}

exports.cancel = async (req, res) => {
    try {
        await Loan.findOneAndUpdate({ _id: req.params.id, store: req.store }, { isDeleted: true })
        return response.success(200, { msg: 'Loan has been canceled' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.reject = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const loan = await Loan.findOneAndUpdate(
                { _id: req.params.id, store: req.store },
                { status: 'REJECTED' },
                { new: true }
            );

            if (!loan) {
                throw new Error('Loan not found');
            }

            await LoanPayment.updateMany(
                { loan: req.params.id },
                { isClosed: true },
            );

            const payment = await Payment.findByIdAndUpdate(
                loan.payment,
                { state: 'REJECTED' },
                { new: true }
            ).populate({
                path: 'transactions',
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            await checkoutTransaction({
                transactions: payment.transactions,
                state: 'REJECTED',
            });

            await reverseProductStock(
                payment.transactions?.flatMap(t => t.stocks),
            );
        });

        return response.success(200, { msg: 'Loan has been rejected' }, res);
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err);
    } finally {
        session.endSession();
    }
};

exports.approve = async (req, res) => {
    try {
        await Loan.findOneAndUpdate({ _id: req.params.id, store: req.store }, { status: 'IN_PROGRESS' })
        return response.success(200, { msg: 'Loan has been approved' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.approveAll = async (req, res) => {
    try {
        const loans = await Loan.updateMany({ status: 'PENDING', store: req.store }, { status: 'APPROVED' })
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
            const files = req.files.map(file => {
                const id = uuid()
                return { ...file, id, filename: file.filename }
            })
            const payment = await Payment.findById(body?.payment).populate('drawer').populate('transactions')
            if (payment.status) return response.failure(422, { msg: 'Payment has already checked out' }, res)
            if (body.totalRemain.USD <= 0) return response.failure(422, { msg: 'No balance to proceed loan' }, res)

            const { listPayment, loanId } = await generateLoanPayment({...body, store: req.store, createdBy: req.user.id})

            const loanBody = {
                ...body,
                totalPaid: { value: body.totalPaid.total, currency: 'USD' },
                totalLoan: body.totalRemain,
                loanPayments: listPayment,
                attachments: files,
                store: req.store,
                createdBy: req.user.id
            }
            const loan = await Loan.create({_id: loanId, ...loanBody})
            if (!loan) return response.failure(422, { msg: 'No loan created!' }, res)
            const paymentMethod = 'loan'
            const data = await Payment.findByIdAndUpdate(body?.payment, { ...body, paymentMethod, status: true, state: 'IN_REVIEW' }, { new: true }).populate({ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } } }).populate('customer').populate('createdBy', 'username')
            
            if (data.customer) {
                const paymentPoint = payment.total.currency === 'USD' ? payment.total.value : payment.total.value / payment.rate.buyRate
                calculateCustomerPoint({ customerId: data.customer, paymentPoint })
                    .catch(err => console.error(err))
            }
            checkoutTransaction({ transactions: data.transactions, state: 'IN_REVIEW' })
                .then((message) => console.info(message))
                .catch(err => console.error(err))

            // Send message to Telegram
            sendTelegram(data)
                .catch(err => console.error(err))
            
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
        const loanToBePaid = await LoanPayment.findOne({ loan: loanPayment.loan, isPaid: false }).sort({ dueDate: 1 })
        if (loanToBePaid._id.toString() !== id) return response.failure(422, { msg: 'Please pay the earliest loan payment first' }, res)
        if (loanPayment.isDeleted) return response.failure(422, { msg: 'Loan has already deleted' }, res)
        if (loanPayment.isPaid) return response.failure(422, { msg: 'Loan has already completed' }, res)

        const drawer = req.user?.drawer
        if (!drawer) return response.failure(422, { msg: 'No drawer opened' }, res)

        calculateReturnCashes(drawer?.cashes, body.remainTotal, { sellRate: drawer.sellRate, buyRate: drawer.buyRate })
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(drawer?._id, { cashes })
                const data = await LoanPayment.findByIdAndUpdate(id, { ...body, returnCashes, isPaid: true, paymentDate: new Date() }, { new: true }).populate('createdBy', 'username')

                const loan = await Loan.findOne({ _id: data.loan, store: req.store })
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
                if (totalRemain <= 0) {
                    loan.status = 'COMPLETED'
                }
                loan.totalRemain = {
                    USD: totalRemain,
                    KHR: totalRemain * drawer.sellRate,
                }
                await loan.save()

                // Send message to Telegram
                const storeConfig = await StoreSetting.findOne({ store: req.store })
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
        const loan = await Loan.findOne({ _id: id, store: req.store })
        if (loan.status !== 'IN_PROGRESS') return response.failure(422, { msg: 'Loan has already paid' }, res)

        const drawer = req.user?.drawer
        if (!drawer) return response.failure(422, { msg: 'No drawer opened' }, res)

        calculateReturnCashes(drawer.cashes, body.remainTotal, { sellRate: drawer.sellRate, buyRate: drawer.buyRate })
            .then(async ({ cashes, returnCashes }) => {
                await Drawer.findByIdAndUpdate(drawer?._id, { cashes })
                const data = await Loan.findOneAndUpdate({ _id: id, store: req.store }, {
                        paymentObj: {
                            ...body,
                            returnCashes,
                            status: true,
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
                const storeConfig = await StoreSetting.findOne({ store: req.store })
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

exports.uploadAttachment = async (req, res) => {
    uploadFiles(req, res, async (err) => {
        if (err) return response.failure(422, { msg: err.message }, res, err)
        try {
            const id = req.params.id
            const files = req.files.map(file => {
                const id = uuid()
                return { ...file, id, filename: file.filename }
            })
            const loan = await Loan.findOne({ _id: id, store: req.store })
            loan.attachments = [ ...loan.attachments, ...files ]
            loan.save()
            response.success(200, { msg: 'Attachment uploaded successfully', data: loan }, res)
        } catch (err) {
            return response.failure(422, { msg: failureMsg.trouble }, res, err)
        }
    })
}

exports.removeAttachment = async (req, res) => {
    try {
        const id = req.params.id
        const fileId = req.body.fileId
        const loan = await Loan.findOne({ _id: id, store: req.store })
        loan.attachments = loan.attachments.filter(file => file.id !== fileId)
        loan.save()
        response.success(200, { msg: 'Attachment removed successfully', data: loan }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.writeOff = async (req, res) => {
    try {
        const body = req.body
        const { error } = loanWriteOffValidation.validate(body, { abortEarly: false })
        if (error) return response.failure(422, extractJoiErrors(error), res)

        const id = req.params.id
        const loan = await Loan.findOne({ _id: id, store: req.store })
        if (!loan) return response.failure(422, { msg: 'No loan found' }, res)
        if (loan?.status === 'COMPLETED') return response.failure(422, { msg: 'Loan has already paid' }, res)

        const transactions = body.transactions
        transactions.forEach(async (transaction) => {
            const loanTransaction = await Transaction.findById(transaction.id).populate('product')
            if (!loanTransaction) return
            if (transaction.writeOffType === 'REPOSSESS') {
                loanTransaction.state = 'REPOSSESSED'
                await loanTransaction.save()

                const product = loanTransaction.product
                if (product) {
                    const addedProduct = await Product.create({
                        name: loanTransaction.product?.name,
                        category: product.category,
                        brand: product.brand,
                        description: transaction.note,
                        detail: product.detail,
                        code: product.code,
                        price: transaction.newPrice,
                        currency: transaction.newPriceCurrency,
                        isStock: true,
                        store: req.store,
                        createdBy: req.user.id,
                    })
                    const addedStock = await ProductStock.create({
                        product: addedProduct._id,
                        quantity: loanTransaction.quantity,
                        cost: transaction.remainingCost,
                        currency: transaction.remainingCostCurrency,
                        store: req.store,
                        createdBy: req.user.id,
                    })
                    addedProduct.stocks.push(addedStock._id)
                    await addedProduct.save()
                    await TransactionClearance.create({
                        amount: transaction.remainingCost,
                        currency: transaction.remainingCostCurrency,
                        note: transaction.note,
                        transaction: loanTransaction._id,
                        newStock: addedStock._id,
                        createdBy: req.user.id,
                        type: 'REPOSSESSION',
                        loan: id,
                        store: req.store
                    })
                }
            } else if (transaction.writeOffType === 'CLEAR') {
                loanTransaction.state = 'CLEARED'
                await loanTransaction.save()
                await TransactionClearance.create({
                    amount: transaction.amount,
                    currency: transaction.currency,
                    note: transaction.note,
                    transaction: loanTransaction._id,
                    createdBy: req.user.id,
                    type: 'CLEARANCE',
                    loan: id,
                    store: req.store
                })
            }
        });
        loan.status = 'WRITTEN_OFF'
        await loan.save()
        await LoanPayment.updateMany({ loan: loan._id, isPaid: false }, { isClosed: true })
        return response.success(200, { msg: 'Loan write-off has been processed successfully' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.preview = (req, res) => {
    const body = req.body
    const listPayment = generateLoanPreview(body)
    return response.success(200, { data: listPayment }, res)
}
