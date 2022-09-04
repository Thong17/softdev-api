const Reservation = require('../models/Reservation')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createReservationValidation } = require('../middleware/validations/reservationValidation')
const StoreStructure = require('../models/StoreStructure')

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
    
    Reservation.find({ isCompleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Reservation.count({ isDisabled: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
}

exports.list = async (req, res) => {
    Reservation.find({ isCompleted: false }, (err, reservations) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: reservations }, res)
    }).select('name tags')
}

exports.detail = async (req, res) => {
    Reservation.findById(req.params.id, (err, reservation) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: reservation }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createReservationValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Reservation.create(body, async (err, reservation) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!reservation) return response.failure(422, { msg: 'No reservation created!' }, res, err)

            const structures = await StoreStructure.find({ _id: { '$in': reservation.structures } })
            for (let i = 0; i < structures.length; i++) {
                const structure = structures[i];
                structure.reservations.push(reservation._id)
                structure.save()
            }

            response.success(200, { msg: 'Reservation has created successfully', data: reservation }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createReservationValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Reservation.findByIdAndUpdate(req.params.id, body, (err, reservation) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!reservation) return response.failure(422, { msg: 'No reservation updated!' }, res, err)
            response.success(200, { msg: 'Reservation has updated successfully', data: reservation }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Reservation.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, reservation) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!reservation) return response.failure(422, { msg: 'No reservation deleted!' }, res, err)
            response.success(200, { msg: 'Reservation has deleted successfully', data: reservation }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const reservations = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: reservations }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const reservations = req.body

        reservations.forEach(reservation => {
            reservation.name = JSON.parse(reservation.name)
            reservation.icon = JSON.parse(reservation.icon)
        })

        Reservation.insertMany(reservations)
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

