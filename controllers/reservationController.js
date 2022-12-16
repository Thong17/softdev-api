const Reservation = require('../models/Reservation')
const Payment = require('../models/Payment')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, calculatePaymentTotal, readExcel } = require('../helpers/utils')
const { createReservationValidation } = require('../middleware/validations/reservationValidation')
const StoreStructure = require('../models/StoreStructure')
const Transaction = require('../models/Transaction')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 0
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
    
    Reservation.find({ isCompleted: false, ...query }, async (err, reservations) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Reservation.count({ isDisabled: false })
        return response.success(200, { data: reservations, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate({ path: 'customer', select: 'picture displayName contact', populate: { path: 'picture' } })
        .populate('structures', 'title status type size')
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
    }).populate({ path: 'payment', populate: [{ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' }}}, { path: 'customer', select: 'displayName point' }, { path: 'createdBy' }] }).populate('customer', 'displayName point').populate('structures')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createReservationValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        if (!body.startAt) delete body.startAt
        Reservation.create({...body, createdBy: req.user.id}, async (err, reservation) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!reservation) return response.failure(422, { msg: 'No reservation created!' }, res, err)

            const structures = await StoreStructure.find({ _id: { '$in': reservation.structures } })
            for (let i = 0; i < structures.length; i++) {
                const structure = structures[i]
                structure.reservations.push(reservation._id)
                structure.status = 'reserved'
                structure.save()
            }

            response.success(200, { msg: 'Reservation has created successfully', data: reservation }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.checkIn = async (req, res) => {
    if (!req.user.drawer) return response.failure(422, { msg: 'Open drawer first!' }, res)

    try {
        const paymentBody = req.body
        const buyRate = req.user.drawer.buyRate
        const sellRate = req.user.drawer.sellRate

        const reservation = await Reservation.findById(req.params.id)
        if (!reservation) return response.failure(422, { msg: 'No reservation found!' }, res)

        const occupiedReservation = await Reservation.count({ status: 'occupied', structures: { '$in': reservation.structures } })
        if (occupiedReservation > 0) return response.failure(422, { msg: 'Please check out the current reservation first' }, res)

        // If the reservation price > 0
        let dataObj = {}
        if (reservation.price.value > 0) {
            const transaction = await Transaction.create({ 
                description: 'Reservation price', 
                price: reservation.price.value, 
                currency: reservation.price.currency,
                total: {
                    value: reservation.price.value,
                    currency: reservation.price.currency
                },
                quantity: 1
            })
            const { total, subtotal } = calculatePaymentTotal([transaction], paymentBody.services, paymentBody.vouchers, paymentBody.discounts, { buyRate, sellRate })
            dataObj = {
                transactions: [transaction._id],
                total,
                subtotal,
                remainTotal: {
                    USD: total.currency === 'USD' ? total.value : 0,
                    KHR: total.currency === 'KHR' ? total.value : 0,
                }
            }
        }
        // End
        
        const countPayment = await Payment.count()
        const invoice = 'INV' + countPayment.toString().padStart(5, '0')
        const payment = await Payment.create({ ...paymentBody, ...dataObj, invoice, createdBy: req.user.id, customer: reservation.customer, drawer: req.user.drawer, reservation: reservation._id, rate: { buyRate, sellRate } })

        reservation.status = 'occupied'
        reservation.startAt = Date.now()
        reservation.payment = payment._id
        reservation.save()

        const structures = await StoreStructure.find({ _id: { '$in': reservation.structures } })
        for (let i = 0; i < structures.length; i++) {
            const structure = structures[i]
            structure.status = 'occupied'
            structure.save()
        }

        const data = await reservation.populate([{ path: 'payment', populate: [{ path: 'transactions' }, { path: 'createdBy' }] }, { path: 'customer', select: 'displayName point' }, { path: 'structures' }])
        response.success(200, { msg: 'Reservation has checked in successfully', data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.checkOut = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
        if (!reservation) return response.failure(422, { msg: 'No reservation found!' }, res, err)

        reservation.endAt = Date.now()
        reservation.status = 'completed'
        reservation.save()

        const structures = await StoreStructure.find({ _id: { '$in': reservation.structures } })
        for (let i = 0; i < structures.length; i++) {
            const structure = structures[i]
            structure.status = 'vacant'
            structure.save()
        }

        const data = await reservation.populate([{ path: 'payment', populate: [{ path: 'transactions', populate: { path: 'product', select: 'profile', populate: { path: 'profile', select: 'filename' }}}, { path: 'customer', select: 'displayName point' }, { path: 'createdBy' }] }, { path: 'structures' }])
        response.success(200, { msg: 'Reservation has checked out successfully', data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body

    try {
        Reservation.findByIdAndUpdate(req.params.id, body, async (err, reservation) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)
            if (!reservation) return response.failure(422, { msg: 'No reservation updated!' }, res, err)

            const structures = await StoreStructure.find({ _id: { '$in': reservation.structures } })
            for (let i = 0; i < structures.length; i++) {
                const structure = structures[i]
                structure.reservations.push(reservation._id)
                structure.status = 'reserved'
                structure.save()
            }
            response.success(200, { msg: 'Reservation has updated successfully', data: reservation }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._delete = async (req, res) => {
    try {
        Reservation.findByIdAndDelete(req.params.id, (err, reservation) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

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

