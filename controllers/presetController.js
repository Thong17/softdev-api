const PresetCash = require('../models/PresetCash')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createPresetCashValidation } = require('../middleware/validations/presetValidation')

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
    
    PresetCash.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await PresetCash.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
}

exports.list = async (req, res) => {
    PresetCash.find({ isDeleted: false }, (err, presetCashs) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: presetCashs }, res)
    }).select('name tags cashes')
}

exports.detail = async (req, res) => {
    PresetCash.findById(req.params.id, (err, presetCash) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: presetCash }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createPresetCashValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        PresetCash.create({...body, createdBy: req.user.id}, (err, presetCash) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'PresetCash already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!presetCash) return response.failure(422, { msg: 'No presetCash created!' }, res, err)
            response.success(200, { msg: 'PresetCash has created successfully', data: presetCash }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.save = async (req, res) => {
    const body = req.body

    try {
        PresetCash.findByIdAndUpdate(req.params.id, body, (err, presetCash) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            if (!presetCash) return response.failure(422, { msg: 'No preset saved!' }, res, err)
            response.success(200, { msg: 'Preset has saved successfully', data: presetCash }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        PresetCash.findByIdAndDelete(req.params.id, (err, presetCash) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!presetCash) return response.failure(422, { msg: 'No preset deleted!' }, res, err)
            response.success(200, { msg: 'Preset has deleted successfully', data: presetCash }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const presetCashs = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: presetCashs }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const presetCashs = req.body

        presetCashs.forEach(presetCash => {
            presetCash.name = JSON.parse(presetCash.name)
            presetCash.icon = JSON.parse(presetCash.icon)
        })

        PresetCash.insertMany(presetCashs)
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

