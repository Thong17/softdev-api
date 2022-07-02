const Brand = require('../models/Brand')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createBrandValidation } = require('../middleware/validations/brandValidation')

exports.index = async (req, res) => {
    Brand.find({ isDeleted: false }, (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: categories }, res)
    }).populate('icon')
}

exports.detail = async (req, res) => {
    Brand.findById(req.params.id, (err, brand) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: brand }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createBrandValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Brand.create(body, (err, brand) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Brand already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand created!' }, res, err)
            response.success(200, { msg: 'Brand has created successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createBrandValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Brand.findByIdAndUpdate(req.params.id, body, (err, brand) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand updated!' }, res, err)
            response.success(200, { msg: 'Brand has updated successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Brand.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, brand) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand deleted!' }, res, err)
            response.success(200, { msg: 'Brand has deleted successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const brands = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: brands }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const brands = req.body

        brands.forEach(brand => {
            brand.name = JSON.parse(brand.name)
            brand.icon = JSON.parse(brand.icon)
        })

        Brand.insertMany(brands)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'branches' : 'branch'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

