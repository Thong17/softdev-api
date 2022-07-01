const Product = require('../models/Product')
const Image = require('../models/Image')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const ProductProperty = require('../models/ProductProperty')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createProductValidation, createPropertyValidation, createOptionValidation, createColorValidation } = require('../middleware/validations/productValidation')


exports.index = async (req, res) => {
    Product.find({ isDeleted: false }, (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: products }, res)
    }).populate('profile').populate('category').populate('brand').populate('images').populate('properties').populate({ path: 'colors', model: ProductColor, populate: { path: 'images', model: Image } }).populate({ path: 'options', model: ProductOption, populate: { path: 'profile', model: Image } })
}

exports.detail = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('images').populate({ path: 'properties', options: { sort: { 'order': 1 } }}).populate({ path: 'colors', model: ProductColor }).populate({ path: 'options', model: ProductOption })

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

            await Image.updateMany({ _id: { $in: product.images } }, { $set: { isActive: true } }, { multi:true })
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
        product.images = JSON.parse(product.images || '[]')
        product.options = JSON.parse(product.options || '[]')
        product.properties = JSON.parse(product.properties || '[]')
        product.colors = JSON.parse(product.colors || '[]')
    })

    Product.insertMany(products)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'products' : 'product'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

exports.batchImage = async (req, res) => {
    const images = req.body

    Image.insertMany(images)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'images' : 'image'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

exports.batchColor = async (req, res) => {
    const colors = req.body

    ProductColor.insertMany(colors)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'colors' : 'color'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

exports.batchProperty = async (req, res) => {
    const properties = req.body

    ProductProperty.insertMany(properties)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'properties' : 'property'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

exports.batchOption = async (req, res) => {
    const options = req.body

    ProductOption.insertMany(options)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'options' : 'option'} has been inserted` }, res)
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

exports.detailProperty = async (req, res) => {
    try {
        const property = await ProductProperty.findById(req.params.id)

        return response.success(200, { data: property }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.updateProperty = async (req, res) => {
    const body = req.body
    const { error } = createPropertyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductProperty.findByIdAndUpdate(req.params.id, body, { new: true }, (err, property) => {
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

exports.reorderProperty = async (req, res) => {
    try {
        await ProductProperty.reorder(req.body)
        response.success(200, { msg: 'Property has reordered successfully' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableProperty = async (req, res) => {
    try {
        ProductProperty.findByIdAndRemove(req.params.id, (err, property) => {
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

exports.detailOption = async (req, res) => {
    try {
        const option = await ProductOption.findById(req.params.id)
            .populate('profile')

        return response.success(200, { data: option }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.updateOption = async (req, res) => {
    const body = req.body
    const { error } = createOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductOption.findByIdAndUpdate(req.params.id, body, { new: true }, (err, option) => {
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
        ProductOption.findByIdAndRemove(req.params.id, (err, option) => {
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

// CRUD Product Color
exports.createColor = async (req, res) => {
    const body = req.body
    const { error } = createColorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductColor.create(body, (err, color) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Color already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color created!' }, res, err)
            response.success(200, { msg: 'Color has created successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detailColor = async (req, res) => {
    try {
        const color = await ProductColor.findById(req.params.id)
            .populate('profile').populate('images')

        return response.success(200, { data: color }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.updateColor = async (req, res) => {
    const body = req.body
    const { error } = createColorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductColor.findByIdAndUpdate(req.params.id, body, { new: true }, (err, color) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color updated!' }, res, err)
            response.success(200, { msg: 'Option has updated successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableColor = async (req, res) => {
    try {
        ProductColor.findByIdAndRemove(req.params.id, (err, color) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color deleted!' }, res, err)
            response.success(200, { msg: 'Option has deleted successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
