const ProductStock = require('../models/ProductStock')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const ProductProperty = require('../models/ProductProperty')
const Product = require('../models/Product')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createStockValidation, convertStockValidation } = require('../middleware/validations/stockValidation')
const { createProductValidation } = require('../middleware/validations/productValidation')
const CustomerOption = require('../models/CustomerOption')
const StockConversion = require('../models/StockConversion')
const { createProductRecord } = require('./productController')
const Category = require('../models/Category')
const Brand = require('../models/Brand')
const mongoose = require('mongoose')

exports.stock = async (req, res) => {
    const product = req.query.productId
    try {
        ProductStock.find({ isDeleted: false, product }).populate('color').populate('options')
            .populate({ path: 'conversion', select: 'fromProduct quantity ratio', populate: { path: 'fromProduct', select: 'name' } })
            .exec((err, stocks) => {
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
        const product = await Product.findById(req.params.id)
            .populate('images').populate({ path: 'stocks', model: ProductStock }).populate({ path: 'colors', model: ProductColor }).populate({ path: 'customers', model: CustomerOption }).populate({ path: 'options', model: ProductOption }).populate('brand').populate('category').populate('properties')

        return response.success(200, { data: product }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.detail = async (req, res) => {
    try {
        const stock = await ProductStock.findById(req.params.id).populate({ path: 'options', model: ProductOption, populate: { path: 'property', model: ProductProperty, select: 'name' } })

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
        ProductStock.create({...body, createdBy: req.user.id, totalQuantity: body.quantity}, (err, stock) => {
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
        ProductStock.findByIdAndUpdate(req.params.id, {...body, totalQuantity: body.quantity}, { new: true }, async (err, stock) => {
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
        ProductStock.findByIdAndRemove(req.params.id, async (err, stock) => {
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

class ConversionError extends Error {
    constructor(msg, code = 422) {
        super(msg)
        this.code = code
    }
}

const isTransactionUnsupported = (err) =>
    err?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(err?.message || '')

// Runs `work` in a Mongo transaction. A standalone Mongo (no replica set) can't
// run transactions, so `work` then runs without a session and undoes its own
// writes if a later step fails.
const runAtomic = async (work) => {
    const session = await mongoose.startSession()
    try {
        let result
        await session.withTransaction(async () => {
            result = await work(session)
        })
        return result
    } catch (err) {
        if (!isTransactionUnsupported(err)) throw err
        return work(null)
    } finally {
        session.endSession()
    }
}

exports.convert = async (req, res) => {
    const body = req.body
    const { error } = convertStockValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    if (body.newProduct && !req.user.role?.privilege?.product?.create) {
        return response.failure(401, { msg: 'You do not have permission to create product!' }, res)
    }

    const { fromProduct, toProduct, newProduct, ratio, quantity, note } = body
    const producedQuantity = quantity * ratio
    const sellRate = req.user.drawer?.sellRate || 4000

    try {
        const result = await runAtomic(async (session) => {
            // Writes to undo when running without a transaction
            const undo = []
            try {
                const source = await Product.findOne({ _id: fromProduct, isDeleted: false }).session(session)
                if (!source) throw new ConversionError('Product not found', 404)

                const stocks = await ProductStock.find({ product: fromProduct, quantity: { $gt: 0 } })
                    .sort({ createdAt: 1, _id: 1 })
                    .session(session)
                const available = stocks.reduce((total, stock) => total + stock.quantity, 0)
                if (available < quantity) throw new ConversionError(`Not enough stock, only ${available} available`)

                // Target product: an existing one or a new one based on the source
                let target
                if (toProduct) {
                    target = await Product.findOne({ _id: toProduct, isDeleted: false }).session(session)
                    if (!target) throw new ConversionError('Target product not found', 404)
                    if (!target.isStock) {
                        await Product.updateOne({ _id: target._id }, { isStock: true }, { session })
                        undo.push(() => Product.updateOne({ _id: target._id }, { isStock: false }))
                    }
                } else {
                    const productBody = {
                        ...newProduct,
                        brand: newProduct.brand || source.brand?.toString(),
                        category: newProduct.category || source.category?.toString(),
                        // The dialog defaults to the source's photos; without any, fall back to its profile
                        profile: newProduct.profile || (newProduct.images ? null : source.profile),
                        images: newProduct.images || [],
                        isStock: true,
                        status: newProduct.status ?? true,
                    }
                    const { error: productError } = createProductValidation.validate(productBody, { abortEarly: false })
                    if (productError) throw new ConversionError(productError.details?.[0]?.message || 'Invalid product')
                    target = await createProductRecord(productBody, req.user.id, session)
                    undo.push(() => Promise.all([
                        Product.deleteOne({ _id: target._id }),
                        Category.updateOne({ _id: target.category }, { $pull: { products: target._id } }),
                        Brand.updateOne({ _id: target.brand }, { $pull: { products: target._id } }),
                    ]))
                }

                // Take bundles oldest batch first, like a sale does
                let remaining = quantity
                const consumedStocks = []
                for (const stock of stocks) {
                    if (remaining < 1) break
                    const take = Math.min(remaining, stock.quantity)
                    const { modifiedCount } = await ProductStock.updateOne(
                        { _id: stock._id, quantity: { $gte: take } },
                        { $inc: { quantity: -take } },
                        { session }
                    )
                    if (!modifiedCount) throw new ConversionError('Stock changed while converting, please try again')
                    undo.push(() => ProductStock.updateOne({ _id: stock._id }, { $inc: { quantity: take } }))
                    consumedStocks.push({ stock: stock._id, quantity: take, cost: stock.cost * take, currency: stock.currency })
                    remaining -= take
                }

                // Batches can be priced in different currencies; mixed costs are totalled in USD
                const currencies = [...new Set(consumedStocks.map(stock => stock.currency || 'USD'))]
                const currency = currencies.length === 1 ? currencies[0] : 'USD'
                const totalCost = consumedStocks.reduce((total, stock) => {
                    if (currency === 'USD' && stock.currency === 'KHR') return total + stock.cost / sellRate
                    return total + stock.cost
                }, 0)

                const conversionId = new mongoose.Types.ObjectId()
                // Inserted directly: the ProductStock save hook reads the product
                // outside the session, which fails for a product created above
                const createdStock = new ProductStock({
                    cost: totalCost / producedQuantity,
                    currency,
                    quantity: producedQuantity,
                    totalQuantity: producedQuantity,
                    product: target._id,
                    conversion: conversionId,
                })
                const now = new Date()
                await ProductStock.collection.insertOne({ ...createdStock.toObject(), createdAt: now, updatedAt: now }, { session })
                undo.push(() => ProductStock.deleteOne({ _id: createdStock._id }))
                await Product.updateOne({ _id: target._id }, { $push: { stocks: createdStock._id } }, { session })
                undo.push(() => Product.updateOne({ _id: target._id }, { $pull: { stocks: createdStock._id } }))

                const [conversion] = await StockConversion.create([{
                    _id: conversionId,
                    fromProduct,
                    toProduct: target._id,
                    quantity,
                    ratio,
                    producedQuantity,
                    consumedStocks,
                    createdStock: createdStock._id,
                    totalCost,
                    currency,
                    isNewProduct: !toProduct,
                    note,
                    createdBy: req.user.id,
                }], { session })
                undo.push(() => StockConversion.deleteOne({ _id: conversionId }))

                // updateOne (not findOneAndUpdate) so the image hook on Product doesn't run
                await Product.updateOne({ _id: fromProduct }, { lastConversion: { product: target._id, ratio } }, { session })

                return { conversion, targetProduct: target, createdStock, remaining: available - quantity }
            } catch (err) {
                if (!session) {
                    for (const revert of undo.reverse()) await revert().catch(() => {})
                }
                throw err
            }
        })

        return response.success(200, { msg: `Converted ${quantity} into ${producedQuantity} successfully`, data: result }, res)
    } catch (err) {
        if (err instanceof ConversionError) return response.failure(err.code, { msg: err.message }, res)
        if (err?.code === 11000) return response.failure(422, { msg: 'Product already exists!' }, res, err)
        return response.failure(422, { msg: err?.message || failureMsg.trouble }, res, err)
    }
}

exports.listConversion = async (req, res) => {
    try {
        const productId = req.params.productId
        const conversions = await StockConversion.find({ $or: [{ fromProduct: productId }, { toProduct: productId }] })
            .sort({ createdAt: -1 })
            .populate('fromProduct', 'name')
            .populate('toProduct', 'name')
            .populate('createdBy', 'username')
        return response.success(200, { data: conversions }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}