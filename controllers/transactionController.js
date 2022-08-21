const Transaction = require('../models/Transaction')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, calculateTransactionTotal } = require('../helpers/utils')
const { createTransactionValidation } = require('../middleware/validations/transactionValidation')
const ProductStock = require('../models/ProductStock')
const Promotion = require('../models/Promotion')


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
    
    Transaction.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Transaction.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('icon')
}

exports.detail = async (req, res) => {
    Transaction.findById(req.params.id, (err, transaction) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: transaction }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createTransactionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        var transactionId = mongoose.Types.ObjectId()
        let filter = { product: body.product }
        if (body.options.length > 0) filter['options'] = { '$in': body.options }
        if (body.color) filter['color'] = body.color

        const stocks = await ProductStock.find(filter)
        let orderQuantity = body.quantity
        let orderStocks = []

        for (let index = 0; index < stocks.length; index++) {
            const stock = stocks[index]
            let remainQuantity = stock.quantity

            if (orderQuantity < 1) break
            if (stock.quantity < 1) continue
            if (orderQuantity > stock.quantity) {
                orderStocks.push(stock._id)
                orderQuantity -= stock.quantity
                remainQuantity = 0
            } else {
                remainQuantity -= orderQuantity
                orderQuantity = 0
            }
            orderStocks.push(stock._id)
            await ProductStock.findByIdAndUpdate(stock._id, { quantity: remainQuantity, transactions: [...stock.transactions, transactionId] })
        }

        if (body.promotion) {
            const promotion = await Promotion.findById(body.promotion)
            body['discount'] = {
                value: promotion.value,
                type: promotion.type,
                isFixed: promotion.isFixed,
            }
            totalTransaction = calculateTransactionTotal(
                { total: body.total, currency: body.currency }, 
                { value: promotion.value, type: promotion.type, isFixed: promotion.isFixed }, 
                { sellRate: 4000, buyRate: 4100 }
            )
            body.total = totalTransaction.total
            body.currency = totalTransaction.currency
        }

        Transaction.create({ ...body, _id: transactionId, stocks: orderStocks }, (err, transaction) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Transaction already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transaction) return response.failure(422, { msg: 'No transaction created!' }, res, err)
            response.success(200, { msg: 'Transaction has created successfully', data: transaction }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createTransactionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Transaction.findByIdAndUpdate(req.params.id, body, (err, transaction) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transaction) return response.failure(422, { msg: 'No transaction updated!' }, res, err)
            response.success(200, { msg: 'Transaction has updated successfully', data: transaction }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Transaction.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, transaction) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transaction) return response.failure(422, { msg: 'No transaction deleted!' }, res, err)
            response.success(200, { msg: 'Transaction has deleted successfully', data: transaction }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
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

