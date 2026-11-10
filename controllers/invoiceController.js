// Everything the A4 / A5 soft invoice needs in one call: the sale (or group
// payment) with its items and customer, the store details and the invoice
// settings.
// GET /sale/payment/invoice/:id         one sale
// GET /sale/payment/invoice/group/:id   a group payment (several sales)
const mongoose = require('mongoose')
const Payment = require('../models/Payment')
const GroupPayment = require('../models/GroupPayment')
const Store = require('../models/Store')
const StoreSetting = require('../models/StoreSetting')
const PaymentInstallment = require('../models/PaymentInstallment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

const customerFields = 'displayName fullName companyName contactPerson taxId contact email address type'

const transactionPopulate = {
    path: 'transactions',
    match: { isDeleted: { $ne: true } },
    // Batch costs never leave the server
    select: '-stockCosts -stocks',
    populate: [
        { path: 'product', select: 'name code' },
        { path: 'options', select: 'name property', populate: { path: 'property', select: 'name' } },
        { path: 'color', select: 'name' },
    ],
}

const loadSale = (query) => query
    .populate('customer', customerFields)
    .populate('createdBy', 'username')
    .populate(transactionPopulate)

const storeDetails = async () => {
    const [store, setting] = await Promise.all([
        Store.findOne().select('name logo address contact other font tax').populate('logo', 'filename').lean(),
        StoreSetting.findOne().select('softInvoice').lean(),
    ])
    const softInvoice = { enabled: false, paperSize: 'A4', showLogo: true, footer: '', ...(setting?.softInvoice || {}) }
    return { store: store || {}, setting: softInvoice }
}

exports.sale = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Payment not found' }, res)
        const payment = await loadSale(Payment.findById(req.params.id)).lean()
        if (!payment) return response.failure(404, { msg: 'Payment not found' }, res)
        const { store, setting } = await storeDetails()
        // Pay Later: money received so far
        const installments = payment.isPayLater
            ? await PaymentInstallment.find({ payment: payment._id }).sort({ paidAt: 1 }).populate('createdBy', 'username').lean()
            : []
        return response.success(200, { data: { payment: { ...payment, installments }, store, setting } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.group = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Group payment not found' }, res)
        const group = await GroupPayment.findById(req.params.id).populate('createdBy', 'username').lean()
        if (!group) return response.failure(404, { msg: 'Group payment not found' }, res)
        const payments = await loadSale(Payment.find({ _id: { $in: group.payments || [] } }).sort({ createdAt: 1 })).lean()
        const { store, setting } = await storeDetails()
        return response.success(200, { data: { group, payments, store, setting } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
