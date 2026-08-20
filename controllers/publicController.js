const Category = require('../models/Category')
const Brand = require('../models/Brand')
const Store = require('../models/Store')
const Announcement = require('../models/Announcement')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

// Reduces a raw promotion doc to the sale price shown on the storefront, or
// null when it isn't currently running or can't be applied without an
// exchange rate (cross-currency fixed discounts aren't shown publicly).
const resolveSalePrice = (price, currency, promotion) => {
    if (!promotion) return null

    const now = new Date()
    if (promotion.startAt && now < promotion.startAt) return null
    if (promotion.expireAt && now > promotion.expireAt) return null

    if (promotion.type === 'PCT') {
        return promotion.isFixed
            ? price * promotion.value / 100
            : price - (price * promotion.value / 100)
    }

    if (promotion.type !== currency) return null
    return promotion.isFixed ? promotion.value : price - promotion.value
}

exports.menu = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false, status: true })
            .select('name icon products')
            .populate('icon', 'filename')
            .populate({
                path: 'products',
                match: { isDeleted: false, status: true },
                select: 'name price currency profile promotion',
                populate: [
                    { path: 'profile', select: 'filename' },
                    { path: 'promotion', select: 'description isFixed startAt expireAt type value' },
                ]
            })

        const data = categories.map((category) => ({
            _id: category._id,
            name: category.name,
            icon: category.icon,
            products: category.products.map((product) => ({
                _id: product._id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                profile: product.profile,
                salePrice: resolveSalePrice(product.price, product.currency, product.promotion),
                promotionLabel: product.promotion?.description,
            })),
        }))

        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.brands = async (req, res) => {
    try {
        const brands = await Brand.find({ isDeleted: false, status: true })
            .select('name icon')
            .populate('icon', 'filename')

        return response.success(200, { data: brands }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.store = async (req, res) => {
    try {
        const store = await Store.findOne()
            .select('name logo contact address')
            .populate('logo', 'filename')

        return response.success(200, { data: store }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.announcements = async (req, res) => {
    try {
        const now = new Date()
        const announcements = await Announcement.find({
            isDeleted: false,
            status: true,
            startAt: { $lte: now },
            expireAt: { $gte: now },
        })
            .select('title description banner order')
            .populate('banner', 'filename')
            .sort('order')

        return response.success(200, { data: announcements }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
