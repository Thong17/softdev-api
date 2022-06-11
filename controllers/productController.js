const Product = require('../models/Product')
const Image = require('../models/Image')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const ProductProperty = require('../models/ProductProperty')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createProductValidation, createPropertyValidation, createOptionValidation } = require('../middleware/validations/productValidation')


exports.index = async (req, res) => {
    Product.find({ isDeleted: false }, (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: products }, res)
    }).populate('profile').populate('category').populate('brand')
}

exports.detail = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('images').populate('properties').populate({ path: 'colors', model: ProductColor }).populate({ path: 'options', model: ProductOption })

        return response.success(200, { data: product }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createProductValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Product.create(body, async (err, product) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Product already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product created!' }, res, err)

            await Image.updateMany({ _id: { $in: doc.images } }, { $set: { isActive: true } }, { multi:true })
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

// CRUD Product Property
exports.createProperty = async (req, res) => {
    const body = req.body
    const { error } = createPropertyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductProperty.create(body, (err, property) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Property already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property created!' }, res, err)
            response.success(200, { msg: 'Property has created successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateProperty = async (req, res) => {
    const body = req.body
    const { error } = createPropertyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductProperty.findByIdAndUpdate(req.params.id, body, (err, property) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property updated!' }, res, err)
            response.success(200, { msg: 'Property has updated successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableProperty = async (req, res) => {
    try {
        ProductProperty.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, property) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property deleted!' }, res, err)
            response.success(200, { msg: 'Property has deleted successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// CRUD Product Option
exports.createOption = async (req, res) => {
    const body = req.body
    const { error } = createOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductOption.create(body, (err, option) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Option already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option created!' }, res, err)
            response.success(200, { msg: 'Option has created successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateOption = async (req, res) => {
    const body = req.body
    const { error } = createOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductOption.findByIdAndUpdate(req.params.id, body, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option updated!' }, res, err)
            response.success(200, { msg: 'Option has updated successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableOption = async (req, res) => {
    try {
        ProductOption.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option deleted!' }, res, err)
            response.success(200, { msg: 'Option has deleted successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}



