const Category = require('../models/Category')
const Brand = require('../models/Brand')
const Store = require('../models/Store')
const Announcement = require('../models/Announcement')
const Product = require('../models/Product')
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

const shapeProduct = (product) => ({
    _id: product._id,
    name: product.name,
    price: product.price,
    currency: product.currency,
    profile: product.profile,
    category: product.category,
    salePrice: resolveSalePrice(product.price, product.currency, product.promotion),
    promotionLabel: product.promotion?.description,
})

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
            products: category.products.map(shapeProduct),
        }))

        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.products = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12
        const page = parseInt(req.query.page) || 0
        const category = req.query.category
        const brand = req.query.brand
        const minPrice = req.query.minPrice !== undefined ? parseFloat(req.query.minPrice) : undefined
        const maxPrice = req.query.maxPrice !== undefined ? parseFloat(req.query.maxPrice) : undefined

        const query = { isDeleted: false, status: true }
        if (category) query.category = category
        if (brand) query.brand = brand
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {}
            if (minPrice !== undefined && !isNaN(minPrice)) query.price.$gte = minPrice
            if (maxPrice !== undefined && !isNaN(maxPrice)) query.price.$lte = maxPrice
        }

        const products = await Product.find(query)
            .select('name price currency profile category promotion')
            .populate('profile', 'filename')
            .populate('category', 'name')
            .populate('promotion', 'description isFixed startAt expireAt type value')
            .sort({ createdAt: 'desc' })
            .skip(page * limit)
            .limit(limit)

        const totalCount = await Product.count(query)

        return response.success(200, { data: products.map(shapeProduct), length: totalCount }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.productPriceRange = async (req, res) => {
    try {
        const result = await Product.aggregate([
            { $match: { isDeleted: false, status: true } },
            { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
        ])
        const range = result[0] || { min: 0, max: 0 }

        return response.success(200, { data: { min: range.min, max: range.max } }, res)
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
