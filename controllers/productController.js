const Product = require('../models/Product')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createProductValidation } = require('../middleware/validations/productValidation')

exports.index = async (req, res) => {
    Product.find({ isDeleted: false }, (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: products }, res)
    }).populate('profile').populate('category').populate('brand')
}

exports.detail = async (req, res) => {
    Product.findById(req.params.id, (err, product) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: product }, res)
    }).populate('images')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createProductValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Product.create(body, (err, product) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Product already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product created!' }, res, err)
            response.success(200, { msg: 'Product has created successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createProductValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Product.findByIdAndUpdate(req.params.id, body, (err, product) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product updated!' }, res, err)
            response.success(200, { msg: 'Product has updated successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Product.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, product) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product deleted!' }, res, err)
            response.success(200, { msg: 'Product has deleted successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const products = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: products }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    const products = req.body

    products.forEach(product => {
        product.name = JSON.parse(product.name)
        product.images = JSON.parse(product.images)
    })

    Product.insertMany(products)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'products' : 'product'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

