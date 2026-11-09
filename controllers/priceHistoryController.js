// What customers paid for products: one row per item sold to a customer, from
// their completed sales (loan sales included), newest first.
// GET /organize/customer/price-history?customer=&product=&search=&page=&limit=
// - customer: one customer's purchases (History button on customer cards)
// - product:  every customer's price for one product (product stock screen)
const mongoose = require('mongoose')
const Payment = require('../models/Payment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isId = (value) => value && mongoose.Types.ObjectId.isValid(value)

exports.list = async (req, res) => {
    const { customer, product } = req.query
    if (!isId(customer) && !isId(product)) return response.failure(422, { msg: 'Choose a customer or a product' }, res)
    if (customer && !isId(customer)) return response.failure(422, { msg: 'Invalid customer' }, res)
    if (product && !isId(product)) return response.failure(422, { msg: 'Invalid product' }, res)

    // Reading one customer's history needs customer access; one product's
    // history across customers needs product access
    const privilege = req.user?.role?.privilege || {}
    if (customer && !privilege.customer?.list) return response.failure(401, { msg: 'You don not have permission!' }, res)
    if (!customer && !privilege.product?.detail) return response.failure(401, { msg: 'You don not have permission!' }, res)

    const limit = Math.min(parseInt(req.query.limit) || 10, 200)
    const page = parseInt(req.query.page) || 0
    const search = (req.query.search || '').trim()

    try {
        const pipeline = [
            {
                $match: {
                    status: true,
                    ...(customer ? { customer: new mongoose.Types.ObjectId(customer) } : { customer: { $ne: null } }),
                },
            },
            { $project: { invoice: 1, createdAt: 1, customer: 1, transactions: 1, rate: 1 } },
            { $unwind: '$transactions' },
            { $lookup: { from: 'transactions', localField: 'transactions', foreignField: '_id', as: 'item' } },
            { $unwind: '$item' },
            {
                $match: {
                    'item.isDeleted': { $ne: true },
                    ...(product ? { 'item.product': new mongoose.Types.ObjectId(product) } : {}),
                },
            },
            { $lookup: { from: 'products', localField: 'item.product', foreignField: '_id', as: 'product' } },
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
            {
                $project: {
                    _id: '$item._id',
                    payment: '$_id',
                    invoice: 1,
                    date: '$createdAt',
                    product: { $arrayElemAt: [{ $map: { input: '$product', as: 'p', in: { _id: '$$p._id', name: '$$p.name', code: '$$p.code' } } }, 0] },
                    customer: { $arrayElemAt: [{ $map: { input: '$customer', as: 'c', in: { _id: '$$c._id', displayName: '$$c.displayName', fullName: '$$c.fullName', companyName: '$$c.companyName' } } }, 0] },
                    description: '$item.description',
                    quantity: '$item.quantity',
                    price: '$item.price',
                    currency: '$item.currency',
                    discount: '$item.discount',
                    total: '$item.total',
                },
            },
        ]
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i')
            pipeline.push({
                $match: {
                    $or: [
                        { description: pattern },
                        { invoice: pattern },
                        { 'product.name.English': pattern },
                        { 'product.name.Khmer': pattern },
                        { 'product.code': pattern },
                        { 'customer.displayName': pattern },
                        { 'customer.fullName': pattern },
                        { 'customer.companyName': pattern },
                    ],
                },
            })
        }
        pipeline.push({
            $facet: {
                data: [{ $sort: { date: -1, payment: -1, _id: 1 } }, { $skip: page * limit }, { $limit: limit }],
                count: [{ $count: 'total' }],
            },
        })

        const [result] = await Payment.aggregate(pipeline)
        return response.success(200, { data: result?.data || [], length: result?.count?.[0]?.total || 0 }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
