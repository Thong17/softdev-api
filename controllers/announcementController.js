const Announcement = require('../models/Announcement')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createAnnouncementValidation } = require('../middleware/validations/announcementValidation')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'order'
    const sort = req.query.sort || 'asc'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }

    Announcement.find({ isDeleted: false, ...query }, async (err, announcements) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Announcement.count({ isDeleted: false })
        return response.success(200, { data: announcements, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('banner')
}

exports.detail = async (req, res) => {
    Announcement.findById(req.params.id, (err, announcement) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: announcement }, res)
    }).populate('banner')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createAnnouncementValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Announcement.create({...body, createdBy: req.user.id}, (err, announcement) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Announcement already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!announcement) return response.failure(422, { msg: 'No announcement created!' }, res, err)
            response.success(200, { msg: 'Announcement has created successfully', data: announcement }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createAnnouncementValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Announcement.findByIdAndUpdate(req.params.id, body, (err, announcement) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!announcement) return response.failure(422, { msg: 'No announcement updated!' }, res, err)
            response.success(200, { msg: 'Announcement has updated successfully', data: announcement }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.toggleStatus = async (req, res) => {
    try {
        const id = req.params.id
        const announcement = await Announcement.findById(id)
        Announcement.findByIdAndUpdate(id, { status: !announcement.status }, { new: true }, async (err, announcement) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            const data = await announcement.populate('banner')
            if (!announcement) return response.failure(422, { msg: 'No announcement updated!' }, res, err)
            response.success(200, { msg: 'Announcement has updated successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Announcement.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, announcement) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!announcement) return response.failure(422, { msg: 'No announcement deleted!' }, res, err)
            response.success(200, { msg: 'Announcement has deleted successfully', data: announcement }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
