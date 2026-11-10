const mongoose = require('mongoose')
const Customer = require('../models/Customer')
const Image = require('../models/Image')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createCustomerValidation } = require('../middleware/validations/customerValidation')
const { applyTierChoice } = require('./customerTierController')
const { evaluateCustomers, getMonths, spentSince, windowStart } = require('../helpers/customerTier')

// A customer's tier with its medal or uploaded icon
const tierPopulate = { path: 'tier', select: 'name discount color icon iconImage', populate: { path: 'iconImage', select: 'filename' } }

// Tier fields go through applyTierChoice, never straight into the document
const splitTier = (body) => {
    const { tier, tierLocked, tierSpent, tierCheckedAt, tierUpdatedAt, ...rest } = body
    return { rest, tier, tierLocked }
}


exports.list = async (req, res) => {
    const limit = parseInt(req.query.limit)
    const offset = parseInt(req.query.offset) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'
    const brand = req.query.brand || 'all'
    const category = req.query.category || 'all'
    const promotion = req.query.promotion
    const favorite = req.query.favorite === 'on'
    const promotions = req.query.promotions === 'on'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }
    let promotionObj = {}
    if (promotions) promotionObj['$ne'] = null
    if (promotion) promotionObj['$e'] = promotion

    if (Object.keys(promotionObj).length > 0) query['promotion'] = promotionObj
    if (brand && brand !== 'all') query['brand'] = brand
    if (category && category !== 'all') query['category'] = category
    if (favorite) query['_id'] = { '$in': req.user?.favorites }

    Customer.find({ isDeleted: false, isDisabled: false, ...query }, async (err, customers) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        const totalCount = await Customer.count({ isDeleted: false, isDisabled: false, ...query  }) 
        let hasMore = totalCount > offset + limit
        if (search !== '' || brand !== 'all' || category !== 'all' || promotion || favorite || promotions) hasMore = true

        return response.success(200, { data: customers, length: totalCount, hasMore }, res)
    })  
        .skip(offset).limit(limit)
        .sort(filterObj)
        .populate('picture', 'filename')
        .populate(tierPopulate)
}

exports.detail = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)

        return response.success(200, { data: customer }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.create = async (req, res) => {
    const { error } = createCustomerValidation.validate(req.body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)
    const { rest: body, tier, tierLocked } = splitTier(req.body)

    try {
        Customer.create({...body, createdBy: req.user.id}, async (err, customer) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Customer already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer created!' }, res, err)

            await Image.updateMany({ _id: { $in: customer.images } }, { $set: { isActive: true } }, { multi:true })
            try {
                // A new customer starts in the tier chosen, or the lowest one
                if (tierLocked) await applyTierChoice({ customerId: customer._id, tierLocked, tier, previous: null, userId: req.user?.id })
                else await evaluateCustomers({ customerIds: [customer._id], mode: 'INITIAL', userId: req.user?.id })
            } catch (tierErr) {
                return response.failure(tierErr.code || 422, { msg: tierErr.message }, res, tierErr)
            }
            const data = await Customer.findById(customer._id).populate(tierPopulate)
            response.success(200, { msg: 'Customer has created successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const { error } = createCustomerValidation.validate(req.body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)
    const { rest: body, tier, tierLocked } = splitTier(req.body)
    try {
        if (body.discount === null) body.discount = 0
        const current = await Customer.findById(req.params.id)
        if (!current) return response.failure(422, { msg: 'No customer updated!' }, res)
        // Tags from the saved customer plus this update, so fields the
        // quick form doesn't send stay searchable
        body.tags = Customer.customerTags({ ...current.toObject(), ...body })
        Customer.findByIdAndUpdate(req.params.id, body, { new: true }, async (err, customer) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer updated!' }, res, err)
            try {
                await applyTierChoice({ customerId: customer._id, tierLocked, tier, previous: current, userId: req.user?.id })
            } catch (tierErr) {
                return response.failure(tierErr.code || 422, { msg: tierErr.message }, res, tierErr)
            }
            const data = await Customer.findById(customer._id).populate(tierPopulate)
            response.success(200, { msg: 'Customer has updated successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Customer.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, customer) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer deleted!' }, res, err)
            response.success(200, { msg: 'Customer has deleted successfully', data: customer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const customers = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: customers }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    const customers = req.body

    customers.forEach(customer => {
        customer.name = JSON.parse(customer.name)
        customer.images = JSON.parse(customer.images || '[]')
        customer.options = JSON.parse(customer.options || '[]')
        customer.properties = JSON.parse(customer.properties || '[]')
        customer.colors = JSON.parse(customer.colors || '[]')
    })

    Customer.insertMany(customers)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'customers' : 'customer'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

// Groups and sources already used, for the customer list filters and form
exports.options = async (req, res) => {
    try {
        const [groups, sources] = await Promise.all([
            Customer.distinct('group', { isDeleted: false, group: { $nin: [null, ''] } }),
            Customer.distinct('source', { isDeleted: false, source: { $nin: [null, ''] } }),
        ])
        return response.success(200, { data: { groups: groups.sort(), sources: sources.sort() } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Customer list (newest customers first by default): each customer with their last purchase, number of sales and
// total spent (USD). `inactiveDays` keeps only customers with no purchase in
// that many days (including those who never bought). `days` in each row is
// the number of days since the last purchase, null when there is none.
exports.rm = async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 200)
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g, '')
    const inactiveDays = req.query.inactiveDays === undefined || req.query.inactiveDays === '' ? null : Number(req.query.inactiveDays)
    if (inactiveDays !== null && (!Number.isFinite(inactiveDays) || inactiveDays < 0)) {
        return response.failure(422, { msg: 'Days must be 0 or more' }, res)
    }
    const sortField = ['lastPurchaseAt', 'totalSpent', 'tierSpent', 'invoiceCount', 'createdAt', 'displayName', 'balance'].includes(req.query.filter) ? req.query.filter : 'createdAt'
    const sortOrder = req.query.sort === 'asc' ? 1 : -1

    const match = { isDeleted: false }
    if (req.query.group) match.group = req.query.group
    if (req.query.source) match.source = req.query.source
    if (req.query.type) match.type = req.query.type
    if (req.query.tier && mongoose.Types.ObjectId.isValid(req.query.tier)) match.tier = new mongoose.Types.ObjectId(req.query.tier)
    if (search) match.tags = { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }

    try {
        const now = new Date()
        const pipeline = [
            { $match: match },
            {
                $lookup: {
                    from: 'payments',
                    let: { customer: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$customer', '$$customer'] }, status: true } },
                        {
                            $group: {
                                _id: null,
                                lastPurchaseAt: { $max: '$createdAt' },
                                invoiceCount: { $sum: 1 },
                                // Pay Later sales count what was paid so far
                                totalSpent: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$isPayLater', true] },
                                            { $ifNull: ['$paidTotal', 0] },
                                            {
                                                $cond: [
                                                    { $eq: ['$total.currency', 'KHR'] },
                                                    { $divide: [{ $ifNull: ['$total.value', 0] }, { $ifNull: ['$rate.buyRate', 4000] }] },
                                                    { $ifNull: ['$total.value', 0] },
                                                ],
                                            },
                                        ],
                                    },
                                },
                                // Still owed on Pay Later sales
                                balance: { $sum: { $cond: [{ $eq: ['$isPayLater', true] }, { $ifNull: ['$balance.USD', 0] }, 0] } },
                            },
                        },
                    ],
                    as: 'sales',
                },
            },
            {
                $addFields: {
                    lastPurchaseAt: { $arrayElemAt: ['$sales.lastPurchaseAt', 0] },
                    invoiceCount: { $ifNull: [{ $arrayElemAt: ['$sales.invoiceCount', 0] }, 0] },
                    totalSpent: { $ifNull: [{ $arrayElemAt: ['$sales.totalSpent', 0] }, 0] },
                    balance: { $ifNull: [{ $arrayElemAt: ['$sales.balance', 0] }, 0] },
                },
            },
            { $lookup: { from: 'customertiers', localField: 'tier', foreignField: '_id', as: 'tier' } },
            { $lookup: { from: 'icons', localField: 'tier.iconImage', foreignField: '_id', as: 'tierIcon' } },
            { $addFields: { tier: { $arrayElemAt: [{ $map: { input: '$tier', as: 'item', in: { _id: '$$item._id', name: '$$item.name', discount: '$$item.discount', color: '$$item.color', icon: '$$item.icon', iconImage: '$$item.iconImage' } } }, 0] } } },
            { $addFields: { tier: { $cond: [{ $ifNull: ['$tier', false] }, { $mergeObjects: ['$tier', { iconImage: { $arrayElemAt: [{ $map: { input: '$tierIcon', as: 'icon', in: { _id: '$$icon._id', filename: '$$icon.filename' } } }, 0] } }] }, null] } } },
            { $project: { sales: 0, tags: 0, tierIcon: 0 } },
        ]
        if (req.query.owing === 'true') pipeline.push({ $match: { balance: { $gt: 0.01 } } })
        if (inactiveDays !== null) {
            const since = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000)
            pipeline.push({ $match: { $or: [{ lastPurchaseAt: null }, { lastPurchaseAt: { $lt: since } }] } })
        }
        pipeline.push({
            $facet: {
                data: [{ $sort: { [sortField]: sortOrder, _id: 1 } }, { $skip: page * limit }, { $limit: limit }],
                count: [{ $count: 'total' }],
            },
        })

        const [result] = await Customer.aggregate(pipeline)
        const dayMs = 24 * 60 * 60 * 1000
        // Spent over the tier window, worked out live for this page with the
        // same rules as the tiers
        const months = await getMonths()
        const pageRows = result?.data || []
        const recent = await spentSince(windowStart(months, now), pageRows.map((customer) => customer._id))
        const data = pageRows.map((customer) => ({
            ...customer,
            days: customer.lastPurchaseAt ? Math.floor((now - new Date(customer.lastPurchaseAt)) / dayMs) : null,
            recentSpent: Math.round((recent.get(String(customer._id)) || 0) * 100) / 100,
        }))
        return response.success(200, { data, length: result?.count?.[0]?.total || 0, months }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
