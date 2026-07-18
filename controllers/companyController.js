const Company = require('../models/Company')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createCompanyValidation } = require('../middleware/validations/companyValidation')

exports.index = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10
        const page = parseInt(req.query.page) || 0
        const search = req.query.search?.replace(/ /g, '')
        const field = req.query.field || 'tags'
        const filter = req.query.filter || 'createdAt'
        const sort = req.query.sort || 'desc'

        let filterObj = { [filter]: sort }
        let query = {}
        if (search) {
            query[field] = {
                $regex: new RegExp(search, 'i')
            }
        }

        const companies = await Company.find({ isDeleted: false, ...query }).skip(page * limit).limit(limit).sort(filterObj).populate('logo').populate('stores')
        const totalCount = await Company.count({ isDeleted: false })
        return response.success(200, { data: companies, length: totalCount }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.list = async (req, res) => {
    try {
        const companies = await Company.find({ isDeleted: false, status: true }).select('name legalName tags logo').populate('logo')
        return response.success(200, { data: companies }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id).populate('logo').populate('stores')
        return response.success(200, { data: company }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createCompanyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const company = await Company.create({ ...body, createdBy: req.user.id })
        return response.success(200, { msg: 'Company has created successfully', data: company }, res)
    } catch (err) {
        if (err.code === 11000) return response.failure(422, { msg: 'Company already exists!' }, res, err)
        return response.failure(422, { msg: err.message }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createCompanyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const company = await Company.findByIdAndUpdate(req.params.id, body, { new: true })
        if (!company) return response.failure(422, { msg: 'No company updated!' }, res)
        return response.success(200, { msg: 'Company has updated successfully', data: company }, res)
    } catch (err) {
        return response.failure(422, { msg: err.message }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true })
        if (!company) return response.failure(422, { msg: 'No company deleted!' }, res)
        return response.success(200, { msg: 'Company has deleted successfully', data: company._id }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
