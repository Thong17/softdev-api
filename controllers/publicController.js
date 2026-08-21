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

// Approximate KHR/USD rate, matching the default used elsewhere in this
// codebase (helpers/utils.js calculatePromotion). Only USD and KHR are
// valid product currencies (constants/variables currencyOptions on the
// frontend), so price filtering/ranging normalizes across just these two
// rather than mixing raw KHR and USD numbers on one scale.
const KHR_PER_USD = 4000
const normalizeToUsd = (price, currency) => (currency === 'KHR' ? price / KHR_PER_USD : price)

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
        const search = (req.query.search || '').replace(/ /g, '')
        const sortField = ['price', 'createdAt'].includes(req.query.filter) ? req.query.filter : 'createdAt'
        const sortOrder = req.query.sort === 'asc' ? 'asc' : 'desc'

        const query = { isDeleted: false, status: true }
        if (category) query.category = category
        if (brand) query.brand = brand
        if (search) query.tags = { $regex: new RegExp(search, 'i') }
        if ((minPrice !== undefined && !isNaN(minPrice)) || (maxPrice !== undefined && !isNaN(maxPrice))) {
            // minPrice/maxPrice arrive in USD (matching /public/products/price-range),
            // so each currency's own bound is converted before filtering.
            const usdRange = {}
            const khrRange = {}
            if (minPrice !== undefined && !isNaN(minPrice)) {
                usdRange.$gte = minPrice
                khrRange.$gte = minPrice * KHR_PER_USD
            }
            if (maxPrice !== undefined && !isNaN(maxPrice)) {
                usdRange.$lte = maxPrice
                khrRange.$lte = maxPrice * KHR_PER_USD
            }
            query.$or = [
                { currency: 'USD', price: usdRange },
                { currency: 'KHR', price: khrRange },
            ]
        }

        const products = await Product.find(query)
            .select('name price currency profile category promotion')
            .populate('profile', 'filename')
            .populate('category', 'name')
            .populate('promotion', 'description isFixed startAt expireAt type value')
            .sort({ [sortField]: sortOrder })
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
        const products = await Product.find({ isDeleted: false, status: true }).select('price currency')
        if (products.length === 0) return response.success(200, { data: { min: 0, max: 0 } }, res)

        const normalized = products.map((product) => normalizeToUsd(product.price, product.currency))

        return response.success(200, { data: { min: Math.min(...normalized), max: Math.max(...normalized) } }, res)
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
