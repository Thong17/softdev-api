const Transaction = require('../models/Transaction')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, calculatePromotion, determineProductStock, reverseProductStock, compareDate, checkProductStock } = require('../helpers/utils')
const { createTransactionValidation, updateTransactionValidation, stockTransactionValidation } = require('../middleware/validations/transactionValidation')
const Promotion = require('../models/Promotion')


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
    
    Transaction.find({ isDeleted: false, ...query }, async (err, transactions) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Transaction.count({ isDeleted: false })
        return response.success(200, { data: transactions, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('createdBy')
}

exports.detail = async (req, res) => {
    Transaction.findById(req.params.id, (err, transaction) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: transaction }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createTransactionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const { isValid, transactionId, orderStocks, stockCosts, stockRemain, msg } = await determineProductStock(body.product, body.color, body.options, body.quantity, null)
        if (!isValid) return response.failure(422, { msg }, res)

        if (body.promotion) {
            const promotion = await Promotion.findById(body.promotion)
            if (promotion && !compareDate(Date.now(), new Date(promotion.expireAt))) {
                body['discount'] = {
                    value: promotion.value,
                    type: promotion.type,
                    isFixed: promotion.isFixed,
                }
                const { total, currency } = calculatePromotion(
                    { total: body.total.value, currency: body.total.currency },
                    { value: promotion.value, type: promotion.type, isFixed: promotion.isFixed }, 
                    { sellRate: req.user?.drawer?.sellRate, buyRate: req.user?.drawer?.buyRate }
                )
                body.total = { value: total, currency }
            }
        }

        Transaction.create({ ...body, _id: transactionId, stocks: orderStocks, stockCosts, createdBy: req.user.id }, async (err, transaction) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Transaction already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transaction) return response.failure(422, { msg: 'No transaction created!' }, res, err)
            const data = await transaction.populate({ path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } })
            response.success(200, { msg: 'Transaction has created successfully', data, stockRemain }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.stock = async (req, res) => {
    const body = req.body
    const { error } = stockTransactionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const { isValid, transactionBody, orderStocks, stockCosts, msg } = await checkProductStock(body.stock, body.quantity)
        if (!isValid) return response.failure(422, { msg }, res)

        if (transactionBody.promotion) {
            const promotion = await Promotion.findById(transactionBody.promotion)
            if (promotion && !compareDate(Date.now(), new Date(promotion.expireAt))) {
                transactionBody['discount'] = {
                    value: promotion.value,
                    type: promotion.type,
                    isFixed: promotion.isFixed,
                }
                const { total, currency } = calculatePromotion(
                    { total: transactionBody.total.value, currency: transactionBody.total.currency },
                    { value: promotion.value, type: promotion.type, isFixed: promotion.isFixed }, 
                    { sellRate: req.user?.drawer?.sellRate, buyRate: req.user?.drawer?.buyRate }
                )
                transactionBody.total = { value: total, currency }
            }
        }

        Transaction.create({ ...transactionBody, stocks: orderStocks, stockCosts, createdBy: req.user.id }, async (err, transaction) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Transaction already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transaction) return response.failure(422, { msg: 'No transaction created!' }, res, err)
            const data = await transaction.populate({ path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } })
            response.success(200, { msg: 'Transaction has created successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = updateTransactionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const id = req.params.id
        const transaction = await Transaction.findById(id)
        if (transaction.status) return response.failure(422, { msg: 'Transaction has already completed' }, res)

        reverseProductStock(transaction?.stocks)
            .then(async () => {
                try {
                    const { isValid, orderStocks, stockCosts, stockRemain, msg } = await determineProductStock(transaction.product, transaction.color, transaction.options, body.quantity, transaction?.stocks)
                    if (!isValid) return response.failure(422, { msg }, res)

                    body.stocks = orderStocks
                    body.stockCosts = stockCosts

                    const { total, currency } = calculatePromotion(
                        { total: body.price * body.quantity, currency: body.currency }, 
                        { value: body.discount.value, type: body.discount.currency, isFixed: body.discount.isFixed }, 
                        { sellRate: req.user?.drawer?.sellRate, buyRate: req.user?.drawer?.buyRate }
                    )
                    body.total = { value: total, currency }

                    Transaction.findByIdAndUpdate(req.params.id, body, { new: true }, async (err, transaction) => {
                        if (err) return response.failure(422, { msg: err.message }, res, err)
            
                        if (!transaction) return response.failure(422, { msg: 'No transaction updated!' }, res, err)
                        const data = await transaction.populate({ path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } })
                        response.success(200, { msg: 'Transaction has updated successfully', data, stockRemain }, res)
                    })
                } catch (err) {
                    return response.failure(422, { msg: failureMsg.trouble }, res, err)
                }
            })
            .catch((err) => {
                return response.failure(err.code, { msg: err.msg }, res, err)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.increaseQuantity = async (req, res) => {
    try {
        const id = req.params.id
        const transaction = await Transaction.findById(id)
        if (transaction.status) return response.failure(422, { msg: 'Transaction has already completed' }, res)

        reverseProductStock(transaction?.stocks)
            .then(async () => {
                try {
                    const increasedQty = transaction.quantity + 1
                    const { isValid, orderStocks, stockCosts, stockRemain, msg } = await determineProductStock(transaction.product, transaction.color, transaction.options, increasedQty, transaction?.stocks)
                    if (!isValid) return response.failure(422, { msg }, res)

                    const body ={
                        stocks: orderStocks,
                        stockCosts: stockCosts,
                        quantity: increasedQty
                    }

                    const { total, currency } = calculatePromotion(
                        { total: transaction.price * increasedQty, currency: transaction.currency }, 
                        { value: transaction.discount.value, type: transaction.discount.currency, isFixed: transaction.discount.isFixed }, 
                        { sellRate: req.user?.drawer?.sellRate, buyRate: req.user?.drawer?.buyRate }
                    )
                    body.total = { value: total, currency }

                    Transaction.findByIdAndUpdate(req.params.id, body, { new: true }, async (err, transaction) => {
                        if (err) return response.failure(422, { msg: err.message }, res, err)
            
                        if (!transaction) return response.failure(422, { msg: 'No transaction updated!' }, res, err)
                        const data = await transaction.populate({ path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } })
                        response.success(200, { msg: 'Transaction has updated successfully', data, stockRemain }, res)
                    })
                } catch (err) {
                    return response.failure(422, { msg: failureMsg.trouble }, res, err)
                }
            })
            .catch((err) => {
                return response.failure(err.code, { msg: err.msg }, res, err)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.decreaseQuantity = async (req, res) => {
    try {
        const id = req.params.id
        const transaction = await Transaction.findById(id)
        if (transaction.status) return response.failure(422, { msg: 'Transaction has already completed' }, res)

        const decreasedQty = transaction.quantity - 1
        if (decreasedQty <= 0) return response.failure(422, { msg: 'Quantity must be greater than zero!' }, res)

        reverseProductStock(transaction?.stocks)
            .then(async () => {
                try {
                    const { isValid, orderStocks, stockCosts, stockRemain, msg } = await determineProductStock(transaction.product, transaction.color, transaction.options, decreasedQty, transaction?.stocks)
                    if (!isValid) return response.failure(422, { msg }, res)

                    const body ={
                        stocks: orderStocks,
                        stockCosts: stockCosts,
                        quantity: decreasedQty
                    }

                    const { total, currency } = calculatePromotion(
                        { total: transaction.price * decreasedQty, currency: transaction.currency }, 
                        { value: transaction.discount.value, type: transaction.discount.currency, isFixed: transaction.discount.isFixed }, 
                        { sellRate: req.user?.drawer?.sellRate, buyRate: req.user?.drawer?.buyRate }
                    )
                    body.total = { value: total, currency }

                    Transaction.findByIdAndUpdate(req.params.id, body, { new: true }, async (err, transaction) => {
                        if (err) return response.failure(422, { msg: err.message }, res, err)
            
                        if (!transaction) return response.failure(422, { msg: 'No transaction updated!' }, res, err)
                        const data = await transaction.populate({ path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' } })
                        response.success(200, { msg: 'Transaction has updated successfully', data, stockRemain }, res)
                    })
                } catch (err) {
                    return response.failure(422, { msg: failureMsg.trouble }, res, err)
                }
            })
            .catch((err) => {
                return response.failure(err.code, { msg: err.msg }, res, err)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.remove = async (req, res) => {
    try {
        const id = req.params.id
        const transaction = await Transaction.findById(id)
        
        reverseProductStock(transaction?.stocks)
            .then(async ({ totalAllStock }) => {
                try {
                    await Transaction.findByIdAndUpdate(id, { isDeleted: true })
                    response.success(200, { msg: 'Transaction has reversed successfully', data: transaction, stockRemain: { totalAllStock, productId: transaction.product } }, res)
                } catch (err) {
                    return response.failure(422, { msg: failureMsg.trouble }, res, err)
                }
            })
            .catch((err) => {
                return response.failure(err.code, { msg: err.msg }, res, err)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.reverseAll = async (req, res) => {
    try {
        response.success(200, { msg: 'All transactions have been reversed' }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports._import = async (req, res) => {
    try {
        const transactions = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: transactions }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const transactions = req.body

        transactions.forEach(transaction => {
            transaction.name = JSON.parse(transaction.name)
            transaction.icon = JSON.parse(transaction.icon)
        })

        Transaction.insertMany(transactions)
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

