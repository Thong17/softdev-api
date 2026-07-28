const ProductStock = require('../models/ProductStock')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const ProductProperty = require('../models/ProductProperty')
const Product = require('../models/Product')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createStockValidation } = require('../middleware/validations/stockValidation')
const CustomerOption = require('../models/CustomerOption')

exports.stock = async (req, res) => {
    const product = req.query.productId
    try {
        ProductStock.find({ isDeleted: false, store: req.store, product }).populate('color').populate('options').exec((err, stocks) => {
            if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

            // Sort so that items with quantity === 0 appear last,
            // and within those groups sort by created date (newest first).
            stocks.sort((a, b) => {
                const aZero = !a.quantity || a.quantity === 0
                const bZero = !b.quantity || b.quantity === 0
                if (aZero !== bZero) return aZero ? 1 : -1

                const aDate = a.createdAt ? new Date(a.createdAt) : (a._id && a._id.getTimestamp ? a._id.getTimestamp() : new Date())
                const bDate = b.createdAt ? new Date(b.createdAt) : (b._id && b._id.getTimestamp ? b._id.getTimestamp() : new Date())
                return bDate - aDate
            })

            return response.success(200, { data: stocks }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.product = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, store: req.store })
            .populate('images').populate({ path: 'stocks', model: ProductStock }).populate({ path: 'colors', model: ProductColor }).populate({ path: 'customers', model: CustomerOption }).populate({ path: 'options', model: ProductOption }).populate('brand').populate('category').populate('properties')

        return response.success(200, { data: product }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.detail = async (req, res) => {
    try {
        const stock = await ProductStock.findOne({ _id: req.params.id, store: req.store }).populate({ path: 'options', model: ProductOption, populate: { path: 'property', model: ProductProperty, select: 'name' } })

        return response.success(200, { data: stock }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.createStock = async (req, res) => {
    const body = req.body
    const { error } = createStockValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductStock.create({...body, store: req.store, createdBy: req.user.id, totalQuantity: body.quantity}, (err, stock) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Stock already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!stock) return response.failure(422, { msg: 'No stock created!' }, res, err)
            response.success(200, { msg: 'Stock has created successfully', data: stock }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateStock = async (req, res) => {
    const body = req.body
    const { error } = createStockValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductStock.findOneAndUpdate({ _id: req.params.id, store: req.store }, {...body, totalQuantity: body.quantity}, { new: true }, async (err, stock) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!stock) return response.failure(422, { msg: 'No stock updated!' }, res, err)

            response.success(200, { msg: 'Stock has updated successfully', data: stock }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableStock = async (req, res) => {
    try {
        ProductStock.findOneAndRemove({ _id: req.params.id, store: req.store }, async (err, stock) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!stock) return response.failure(422, { msg: 'No stock deleted!' }, res, err)

            const product = await Product.findById(stock.product)
            product.stocks = product.stocks.filter(item => !item._id.equals(stock._id))
            product.save()
            response.success(200, { msg: 'Stock has deleted successfully', data: stock }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}