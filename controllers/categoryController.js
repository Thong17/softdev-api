const Category = require('../models/Category')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createCategoryValidation } = require('../middleware/validations/categoryValidation')

exports.index = async (req, res) => {
    Category.find({ isDeleted: false }, (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: categories }, res)
    }).populate('icon')
}

exports.detail = async (req, res) => {
    Category.findById(req.params.id, (err, category) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: category }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createCategoryValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Category.create(body, (err, category) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Category already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category created!' }, res, err)
            response.success(200, { msg: 'Category has created successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createCategoryValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Category.findByIdAndUpdate(req.params.id, body, (err, category) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category updated!' }, res, err)
            response.success(200, { msg: 'Category has updated successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Category.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, category) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category deleted!' }, res, err)
            response.success(200, { msg: 'Category has deleted successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const categories = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: categories }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const categories = req.body

        categories.forEach(category => {
            category.name = JSON.parse(category.name)
            category.icon = JSON.parse(category.icon)
        })

        Category.insertMany(categories)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'categories' : 'category'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

