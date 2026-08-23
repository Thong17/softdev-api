const fs = require('fs')
const path = require('path')
const Category = require('../models/Category')
const Brand = require('../models/Brand')
const Store = require('../models/Store')
const Announcement = require('../models/Announcement')
const Product = require('../models/Product')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const utils = require('../helpers/utils')

// Bulk-imported/seeded products often have no MinIO profile image. Rather than
// always falling back to the generic default.png, /uploads also holds a small
// library of representative photos (see routes/router.js) keyed by slugified
// product name -- read once at startup since the folder only changes on deploy.
const UPLOADS_DIR = path.join(__dirname, '../uploads')
const slugify = (value) =>
    (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
const localImageBySlug = new Map(
    (fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [])
        .filter((file) => file !== 'default.png')
        .map((file) => [file.replace(/\.[^.]+$/, ''), file])
)
const resolveProfile = (product) => {
    if (product.profile) return product.profile
    const localFile = localImageBySlug.get(slugify(product.name?.English))
    return localFile ? { filename: localFile } : product.profile
}

// Approximate KHR/USD rate, matching the default sellRate/buyRate that
// helpers/utils.js calculatePromotion falls back to. Only USD and KHR are
// valid product currencies (constants/variables currencyOptions on the
// frontend), so price filtering/ranging normalizes across just these two
// rather than mixing raw KHR and USD numbers on one scale.
const KHR_PER_USD = 4000
const normalizeToUsd = (price, currency) => (currency === 'KHR' ? price / KHR_PER_USD : price)

// A promotion is only shown publicly while its display window is current.
const isPromotionActive = (promotion) => {
    if (!promotion) return false
    const now = new Date()
    if (promotion.startAt && now < promotion.startAt) return false
    if (promotion.expireAt && now > promotion.expireAt) return false
    return true
}

// Reduces a raw promotion doc to the sale price shown on the storefront, or
// null when it isn't currently running. Reuses calculatePromotion (same
// logic as admin cashing) so PCT/USD/KHR types and the isFixed flag are
// handled identically -- there's no live cash-drawer exchange rate on the
// public storefront, so this falls back to calculatePromotion's own default
// sellRate/buyRate (same as admin does when no drawer rate is available).
const resolveSalePrice = (price, currency, promotion) => {
    if (!isPromotionActive(promotion)) return null

    const { total, currency: resultCurrency } = utils.calculatePromotion({ total: price, currency }, promotion, {})

    if (resultCurrency === currency) return total

    // isFixed promotions priced in a different currency than the product
    // (e.g. a fixed $1 USD price on a KHR product) flip the result currency --
    // convert back to the product's own currency so salePrice/price can keep
    // rendering side by side in one currency on the storefront.
    const usdTotal = resultCurrency === 'KHR' ? total / KHR_PER_USD : total
    return currency === 'KHR' ? usdTotal * KHR_PER_USD : usdTotal
}

const shapeProduct = (product) => {
    const activePromotion = isPromotionActive(product.promotion) ? product.promotion : null

    return {
        _id: product._id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        profile: resolveProfile(product),
        category: product.category,
        salePrice: resolveSalePrice(product.price, product.currency, product.promotion),
        promotionLabel: activePromotion?.description,
        promotion: activePromotion && {
            type: activePromotion.type,
            value: activePromotion.value,
            isFixed: activePromotion.isFixed,
        },
    }
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
