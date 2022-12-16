const Promotion = require('../models/Promotion')
const Product = require('../models/Product')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createPromotionValidation } = require('../middleware/validations/promotionValidation')

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

    Promotion.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Promotion.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
}

exports.detail = async (req, res) => {
    Promotion.findById(req.params.id, (err, promotion) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: promotion }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createPromotionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Promotion.create({...body, createdBy: req.user.id}, async (err, promotion) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Promotion already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }
            await Product.updateMany({ _id: { '$in': body.products } }, { promotion: promotion._id })
            
            if (!promotion) return response.failure(422, { msg: 'No promotion created!' }, res, err)
            response.success(200, { msg: 'Promotion has created successfully', data: promotion }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createPromotionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const promotion = await Promotion.findById(req.params.id)
        if (!promotion) return response.failure(422, { msg: 'No promotion updated!' }, res, err)

        await Product.updateMany({ _id: { '$in': promotion.products } }, { promotion: null })

        promotion.description = body.description
        promotion.value = body.value
        promotion.type = body.type
        promotion.startAt = body.startAt
        promotion.expireAt = body.expireAt
        promotion.isFixed = body.isFixed
        promotion.products = body.products
        promotion.save()

        await Product.updateMany({ _id: { '$in': body.products } }, { promotion: promotion._id })

        response.success(200, { msg: 'Promotion has updated successfully', data: promotion }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Promotion.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, promotion) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!promotion) return response.failure(422, { msg: 'No promotion deleted!' }, res, err)
            response.success(200, { msg: 'Promotion has deleted successfully', data: promotion }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
