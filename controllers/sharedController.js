const response = require('../helpers/response')
const Icon = require('../models/Icon')
const Image = require('../models/Image')
const Picture = require('../models/Picture')
const { failureMsg } = require('../constants/responseMsg')
const StoreStructure = require('../models/StoreStructure')
const Reservation = require('../models/Reservation')
const moment = require('moment/moment')

exports.uploadImageController = (req, res) => {
    const files = req.files.map(file => {
        return { filename: file.filename }
    })
    try {
        Image.insertMany(files, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No image uploaded!' }, res, err)
            response.success(200, { msg: 'Images has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.uploadIconController = (req, res) => {
    try {
        Icon.create({ filename: req.file.filename }, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No icon uploaded!' }, res, err)
            response.success(200, { msg: 'Icon has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.uploadPictureController = (req, res) => {
    try {
        Picture.create({ filename: req.file.filename }, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No picture uploaded!' }, res, err)
            response.success(200, { msg: 'Picture has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.structureCapacity = async (req, res) => {
    try {
        const structures = await StoreStructure.find({ isDisabled: false }).select('status endAt startAt')
        let vacant = 0
        let reserved = 0
        let occupied = 0
        let avgWaiting = null
        structures.forEach(structure => {
            switch (structure.status) {
                case 'reserved':
                    reserved += 1
                    break

                case 'occupied':
                    occupied += 1
                    break
            
                default:
                    vacant += 1
                    break
            }
        })
        if (vacant > 0) return response.success(200, { data: { vacant, reserved, occupied, total: structures.length, avgWaiting } }, res)

        const reservations = await Reservation.find({ isCompleted: false })

        listRemaining = []
        let totalRemaining = 0
        reservations.forEach(reservation => {
            const endAt = reservation.endAt || moment(reservation.startAt).add(2, 'hours')
            const remainTime = moment(endAt).diff(moment(Date.now()))
            if (remainTime > 0) listRemaining.push(remainTime)
        })
        if (listRemaining.length > 0) {
            totalRemaining = Math.min(...listRemaining)
        }
        avgWaiting = moment.duration(totalRemaining).humanize()

        return response.success(200, { data: { vacant, reserved, occupied, total: structures.length, avgWaiting } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}