const Queue = require('../models/Queue')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createQueueValidation } = require('../middleware/validations/queueValidation')

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

    Queue.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Queue.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createQueueValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const latestQueue = await Queue.findOne().sort('-createdAt')
        const latestTicket = parseInt(latestQueue?.ticket) || 0
        const ticket = latestTicket >= process.env.MAX_QUEUE_NUMBER ? 1 : latestTicket + 1
        Queue.create({...body, ticket, createdBy: req.user.id}, async (err, queue) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            
            if (!queue) return response.failure(422, { msg: 'No queue created!' }, res, err)
            response.success(200, { msg: 'Queue has created successfully', data: queue }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createQueueValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const queue = await Queue.findByIdAndUpdate(req.params.id, body)
        if (!queue) return response.failure(422, { msg: 'No queue updated!' }, res, err)

        response.success(200, { msg: 'Queue has updated successfully', data: queue }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.cancel = async (req, res) => {
    Queue.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, queue) => {
        if (err) return response.failure(422, { msg: err.message }, res, err)

        if (!queue) return response.failure(422, { msg: 'No queue deleted!' }, res, err)
        response.success(200, { msg: 'Queue has deleted successfully', data: queue }, res)
    })
}
