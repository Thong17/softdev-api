const Membership = require('../models/Membership')
const Customer = require('../models/Customer')
const Product = require('../models/Product')
const Promotion = require('../models/Promotion')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createMembershipValidation } = require('../middleware/validations/membershipValidation')

/**
 * Get list of memberships with pagination and search
 */
exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g, '')
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query.$or = [
            { name: { $regex: new RegExp(search, 'i') } },
            { description: { $regex: new RegExp(search, 'i') } }
        ]
    }

    Membership.find({ isDeleted: false, ...query }, async (err, memberships) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Membership.countDocuments({ isDeleted: false, ...query })
        return response.success(200, { data: memberships, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('createdBy', 'displayName')
}

/**
 * Get membership detail by ID
 */
exports.detail = async (req, res) => {
    Membership.findById(req.params.id, (err, membership) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        if (!membership) return response.failure(404, { msg: 'Membership not found' }, res)
        return response.success(200, { data: membership }, res)
    })
        .populate('createdBy', 'displayName')
        .populate('discounts.target')
}

/**
 * Create new membership
 */
exports.create = async (req, res) => {
    const body = req.body
    const { error } = createMembershipValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    // Validate discount targets exist
    if (body.discounts && body.discounts.length > 0) {
        for (const discount of body.discounts) {
            let Model
            switch (discount.type) {
                case 'product':
                    Model = Product
                    break
                case 'category':
                    Model = require('../models/Category')
                    break
                case 'brand':
                    Model = require('../models/Brand')
                    break
            }
            const target = await Model.findById(discount.target)
            if (!target) {
                return response.failure(422, { msg: `${discount.type} with ID ${discount.target} not found` }, res)
            }
        }
    }

    try {
        Membership.create({ ...body, createdBy: req.user.id }, async (err, membership) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Membership already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }
            if (!membership) return response.failure(422, { msg: 'No membership created!' }, res, err)
            response.success(200, { msg: 'Membership has created successfully', data: membership }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Update membership
 */
exports.update = async (req, res) => {
    const body = req.body
    const { error } = createMembershipValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const membership = await Membership.findById(req.params.id)
        if (!membership) return response.failure(404, { msg: 'No membership updated!' }, res, err)

        // Validate discount targets exist
        if (body.discounts && body.discounts.length > 0) {
            for (const discount of body.discounts) {
                let Model
                switch (discount.type) {
                    case 'product':
                        Model = Product
                        break
                    case 'category':
                        Model = require('../models/Category')
                        break
                    case 'brand':
                        Model = require('../models/Brand')
                        break
                }
                const target = await Model.findById(discount.target)
                if (!target) {
                    return response.failure(422, { msg: `${discount.type} with ID ${discount.target} not found` }, res)
                }
            }
        }

        membership.name = body.name || membership.name
        membership.description = body.description !== undefined ? body.description : membership.description
        membership.discounts = body.discounts || membership.discounts
        membership.startAt = body.startAt || membership.startAt
        membership.expireAt = body.expireAt || membership.expireAt
        membership.note = body.note !== undefined ? body.note : membership.note
        membership.isActive = body.isActive !== undefined ? body.isActive : membership.isActive

        await membership.save()

        response.success(200, { msg: 'Membership has updated successfully', data: membership }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Delete (soft delete) membership
 */
exports.disable = async (req, res) => {
    try {
        Membership.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, membership) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!membership) return response.failure(404, { msg: 'No membership deleted!' }, res, err)
            response.success(200, { msg: 'Membership has deleted successfully', data: membership }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Get the best applicable discount for a product
 * This function compares membership discounts with promotions and returns the highest discount
 */
exports.getBestDiscount = async (req, res) => {
    try {
        const { productId, customerId } = req.params

        // Get the product
        const product = await Product.findById(productId)
            .populate('category')
            .populate('brand')
        if (!product) {
            return response.failure(404, { msg: 'Product not found' }, res)
        }

        let bestDiscount = null
        let bestDiscountValue = 0
        let discountSource = null // 'membership' or 'promotion'

        // Get customer's membership if exists
        let customerMembership = null
        if (customerId) {
            const customer = await Customer.findById(customerId).populate('membership')
            if (customer && customer.membership) {
                customerMembership = customer.membership
            }
        }

        const now = new Date()

        // Check membership discounts
        if (customerMembership && customerMembership.isActive && !customerMembership.isDeleted) {
            if (customerMembership.startAt <= now && customerMembership.expireAt >= now) {
                for (const discount of customerMembership.discounts) {
                    let applies = false

                    switch (discount.type) {
                        case 'product':
                            applies = discount.target._id.toString() === productId
                            break
                        case 'category':
                            applies = product.category && discount.target._id.toString() === product.category._id.toString()
                            break
                        case 'brand':
                            applies = product.brand && discount.target._id.toString() === product.brand._id.toString()
                            break
                    }

                    if (applies) {
                        const discountValue = calculateDiscountValue(discount.discountType, discount.value, product.price)
                        if (discountValue > bestDiscountValue) {
                            bestDiscountValue = discountValue
                            bestDiscount = discount
                            discountSource = 'membership'
                        }
                    }
                }
            }
        }

        // Check promotions
        const activePromotions = await Promotion.find({
            isDeleted: false,
            isDisabled: false,
            startAt: { $lte: now },
            expireAt: { $gte: now }
        }).populate('products')

        for (const promotion of activePromotions) {
            const applies = promotion.products.some(p => p._id.toString() === productId)
            if (applies) {
                const discountValue = calculateDiscountValue(promotion.type, promotion.value, product.price)
                if (discountValue > bestDiscountValue) {
                    bestDiscountValue = discountValue
                    bestDiscount = promotion
                    discountSource = 'promotion'
                }
            }
        }

        return response.success(200, {
            data: {
                discount: bestDiscount,
                discountValue: bestDiscountValue,
                source: discountSource,
                productPrice: product.price,
                finalPrice: product.price - bestDiscountValue
            }
        }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Get applicable discounts for a customer (all products)
 */
exports.getCustomerDiscounts = async (req, res) => {
    try {
        const { customerId } = req.params

        const customer = await Customer.findById(customerId).populate('membership')
        if (!customer) {
            return response.failure(404, { msg: 'Customer not found' }, res)
        }

        const now = new Date()
        let discounts = []

        // Get membership discounts
        if (customer.membership && customer.membership.isActive && !customer.membership.isDeleted) {
            if (customer.membership.startAt <= now && customer.membership.expireAt >= now) {
                discounts.push({
                    source: 'membership',
                    membership: customer.membership,
                    discounts: customer.membership.discounts
                })
            }
        }

        // Get active promotions
        const activePromotions = await Promotion.find({
            isDeleted: false,
            isDisabled: false,
            startAt: { $lte: now },
            expireAt: { $gte: now }
        }).populate('products')

        if (activePromotions.length > 0) {
            discounts.push({
                source: 'promotion',
                promotions: activePromotions
            })
        }

        return response.success(200, { data: discounts }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Assign membership to customer
 */
exports.assignToCustomer = async (req, res) => {
    const { customerId, membershipId } = req.body

    if (!customerId || !membershipId) {
        return response.failure(422, { msg: 'Customer ID and Membership ID are required' }, res)
    }

    try {
        const customer = await Customer.findById(customerId)
        if (!customer) {
            return response.failure(404, { msg: 'Customer not found' }, res)
        }

        const membership = await Membership.findById(membershipId)
        if (!membership) {
            return response.failure(404, { msg: 'Membership not found' }, res)
        }

        customer.membership = membershipId
        await customer.save()

        return response.success(200, { msg: 'Membership assigned successfully', data: customer }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Remove membership from customer
 */
exports.removeFromCustomer = async (req, res) => {
    const { customerId } = req.params

    try {
        const customer = await Customer.findById(customerId)
        if (!customer) {
            return response.failure(404, { msg: 'Customer not found' }, res)
        }

        customer.membership = null
        await customer.save()

        return response.success(200, { msg: 'Membership removed successfully', data: customer }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

/**
 * Helper function to calculate discount value
 */
function calculateDiscountValue(discountType, value, price) {
    if (discountType === 'percentage') {
        return (price * value) / 100
    } else if (discountType === 'fixed') {
        return Math.min(value, price) // Don't go negative
    }
    return 0
}