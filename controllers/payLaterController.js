// Pay Later: a sale that's sold now and paid over time.
// - checkout-later: completes the sale with an optional deposit, due date,
//   note and one-time fee (on the balance after the deposit)
// - collect: records a payment towards the balance
// Each amount received is a PaymentInstallment, which is what revenue reports
// count for these sales. Cash, Transfer and Loan sales are untouched.
const Joi = require('joi')
const mongoose = require('mongoose')
const Payment = require('../models/Payment')
const PaymentInstallment = require('../models/PaymentInstallment')
const Drawer = require('../models/Drawer')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, calculateReturnCashes, checkoutTransaction, calculateCustomerPoint } = require('../helpers/utils')
const { onPaymentCompleted } = require('../helpers/customerTier')
const { installmentCost } = require('../helpers/payLaterRevenue')

const TOLERANCE = 0.01
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const sellRateOf = (payment) => payment?.rate?.sellRate || payment?.rate?.buyRate || 4000

// The sale total in USD, the way the payment dialog shows it
const totalUSD = (payment) => {
    const value = Number(payment?.total?.value) || 0
    return payment?.total?.currency === 'KHR' ? value / sellRateOf(payment) : value
}

// One-time fee on what's owed after the deposit, in USD
const feeAmount = (fee, base, payment) => {
    const value = Number(fee?.value) || 0
    if (!value) return 0
    if (fee.type === 'PCT') return (base * value) / 100
    if (fee.type === 'KHR') return value / sellRateOf(payment)
    return value
}

const amountReceived = (receiveTotal) => Number(receiveTotal?.total) || 0

const checkoutLaterValidation = Joi.object({
    customer: Joi.string().required().messages({ 'any.required': 'Choose a customer for Pay Later', 'string.empty': 'Choose a customer for Pay Later' }),
    dueDate: Joi.date().optional().allow(null, ''),
    note: Joi.string().max(500).optional().allow(''),
    fee: Joi.object({
        value: Joi.number().min(0).optional().allow(null, ''),
        type: Joi.string().valid('PCT', 'USD', 'KHR').optional(),
    }).optional().allow(null),
    receiveCashes: Joi.array().optional(),
    receiveTotal: Joi.object().optional().allow(null),
    paymentMethod: Joi.string().valid('cash', 'transfer').optional().allow(null, ''),
})

const collectValidation = Joi.object({
    // Optional fee added to what's owed with this collection (e.g. late fee)
    fee: Joi.object({
        value: Joi.number().min(0).optional().allow(null, ''),
        type: Joi.string().valid('PCT', 'USD', 'KHR').optional(),
    }).optional().allow(null),
    receiveCashes: Joi.array().optional(),
    receiveTotal: Joi.object().required(),
    paymentMethod: Joi.string().valid('cash', 'transfer').optional().allow(null, ''),
})

// Records money received towards a Pay Later sale: takes any change out of
// the drawer (like checkout does), saves the installment, adds customer
// points and may move the customer up a tier. `due` is what is still owed
// before this payment; anything above it is change.
const recordInstallment = async ({ payment, received, due, receiveCashes, receiveTotal, paymentMethod, drawer, userId, kind, groupPayment, fee }) => {
    const amount = round2(Math.min(received, due))
    const cost = await installmentCost(payment, amount, due)
    const change = Math.max(0, received - due)
    const sellRate = sellRateOf(payment)
    let returnCashes = []
    if (drawer) {
        const result = await calculateReturnCashes(drawer.cashes || [], { USD: -change, KHR: -change * sellRate }, { sellRate, buyRate: payment?.rate?.buyRate })
        returnCashes = result.returnCashes
        await Drawer.findByIdAndUpdate(drawer._id, { cashes: result.cashes })
    }
    const installment = await PaymentInstallment.create({
        payment: payment._id,
        customer: payment.customer?._id || payment.customer,
        amount,
        receiveCashes: receiveCashes || [],
        receiveTotal,
        returnCashes,
        rate: payment.rate,
        paymentMethod: paymentMethod || 'cash',
        kind,
        fee: fee || undefined,
        cost,
        drawer: drawer?._id,
        groupPayment,
        createdBy: userId,
        paidAt: new Date(),
    })
    const customerId = payment.customer?._id || payment.customer
    if (customerId && amount > 0) {
        await calculateCustomerPoint({ customerId, paymentPoint: amount }).catch(() => {})
        onPaymentCompleted(customerId)
    }
    return installment
}

// Balance fields after `paid` more USD is received
const balanceAfter = (payment, owedBefore, paid) => {
    const owed = round2(Math.max(0, owedBefore - paid))
    return {
        paidTotal: round2((payment.paidTotal || 0) + paid),
        balance: { USD: owed, KHR: Math.round(owed * sellRateOf(payment)) },
        state: owed <= TOLERANCE ? 'COMPLETED' : 'PAY_LATER',
    }
}

exports.checkoutLater = async (req, res) => {
    const { error, value: body } = checkoutLaterValidation.validate(req.body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Payment not found' }, res)

    try {
        const payment = await Payment.findById(req.params.id).populate({ path: 'transactions', match: { isDeleted: { $ne: true } } })
        if (!payment) return response.failure(404, { msg: 'Payment not found' }, res)
        if (payment.status) return response.failure(422, { msg: 'Payment has already checked out' }, res)
        if (!payment.transactions?.length) return response.failure(422, { msg: 'No transaction added' }, res)

        const total = round2(totalUSD(payment))
        const deposit = amountReceived(body.receiveTotal)
        if (deposit > total + TOLERANCE) return response.failure(422, { msg: 'The deposit is more than the total; use Cash or Transfer instead' }, res)
        if (body.fee?.type === 'PCT' && Number(body.fee?.value) > 100) return response.failure(422, { msg: 'A % fee can be at most 100%' }, res)
        const drawer = deposit > 0 ? req.user?.drawer : null
        if (deposit > 0 && !drawer) return response.failure(422, { msg: 'Open drawer first!' }, res)

        const base = Math.max(0, total - deposit)
        const fee = round2(feeAmount(body.fee, base, payment))
        const owedBeforeDeposit = total + fee

        payment.customer = body.customer
        payment.paymentMethod = 'later'
        payment.isPayLater = true
        payment.status = true
        payment.payLater = {
            dueDate: body.dueDate || undefined,
            note: body.note || '',
            fee: { value: Number(body.fee?.value) || 0, type: body.fee?.type || 'PCT', amount: fee },
        }
        // The deposit is recorded before the sale is marked sold, so a sale
        // never shows as sold with money taken but not recorded. If the sale
        // then fails to save, the deposit is removed and nothing is sold.
        const installment = deposit > 0
            ? await recordInstallment({
                payment, received: deposit, due: owedBeforeDeposit, receiveCashes: body.receiveCashes, receiveTotal: body.receiveTotal,
                paymentMethod: body.paymentMethod, drawer, userId: req.user.id, kind: 'DEPOSIT',
            })
            : null
        Object.assign(payment, balanceAfter({ ...payment.toObject(), paidTotal: 0 }, owedBeforeDeposit, installment ? installment.amount : 0))
        try {
            await payment.save()
        } catch (saveErr) {
            if (installment) await PaymentInstallment.deleteOne({ _id: installment._id }).catch(() => {})
            throw saveErr
        }
        await checkoutTransaction({ transactions: payment.transactions })

        const data = await loadPayment(payment._id)
        return response.success(200, { msg: 'Saved as Pay Later', data }, res)
    } catch (err) {
        if (err?.code === 422) return response.failure(422, { msg: err.msg }, res)
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.collect = async (req, res) => {
    const { error, value: body } = collectValidation.validate(req.body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Payment not found' }, res)

    try {
        const payment = await Payment.findById(req.params.id)
        if (!payment || !payment.isPayLater) return response.failure(404, { msg: 'Pay Later sale not found' }, res)
        const owedBefore = round2(payment.balance?.USD || 0)
        if (owedBefore <= TOLERANCE) return response.failure(422, { msg: 'This sale is already fully paid' }, res)
        if (body.fee?.type === 'PCT' && Number(body.fee?.value) > 100) return response.failure(422, { msg: 'A % fee can be at most 100%' }, res)
        // A fee charged now (% of what's owed) is added before the payment
        const fee = round2(feeAmount(body.fee, owedBefore, payment))
        const owed = round2(owedBefore + fee)
        const received = amountReceived(body.receiveTotal)
        if (received <= 0) return response.failure(422, { msg: 'Enter the amount received' }, res)
        if (body.paymentMethod === 'transfer' && received > owed + TOLERANCE) return response.failure(422, { msg: "A transfer can't be more than what's owed" }, res)
        const drawer = req.user?.drawer
        if (!drawer) return response.failure(422, { msg: 'Open drawer first!' }, res)

        const installment = await recordInstallment({
            payment, received, due: owed, receiveCashes: body.receiveCashes, receiveTotal: body.receiveTotal,
            paymentMethod: body.paymentMethod, drawer, userId: req.user.id, kind: 'COLLECT',
            fee: fee > 0 ? { value: Number(body.fee?.value) || 0, type: body.fee?.type || 'PCT', amount: fee } : null,
        })
        Object.assign(payment, balanceAfter(payment.toObject(), owed, installment.amount))
        if (fee > 0) payment.set('payLater.collectFees', round2((payment.payLater?.collectFees || 0) + fee))
        await payment.save()

        const data = await loadPayment(payment._id)
        return response.success(200, { msg: payment.state === 'COMPLETED' ? 'Paid in full' : 'Payment recorded', data, installment }, res)
    } catch (err) {
        if (err?.code === 422) return response.failure(422, { msg: err.msg }, res)
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Settles the full balance of an owing Pay Later sale inside a group payment.
// Used by group-checkout; change is handled by the group itself.
exports.settleInGroup = async ({ payment, groupPayment, paymentMethod, drawer, userId }) => {
    const owed = round2(payment.balance?.USD || 0)
    if (owed <= TOLERANCE) return null
    const installment = await recordInstallment({
        payment, received: owed, due: owed, receiveCashes: [], receiveTotal: { total: owed },
        paymentMethod, drawer: null, userId, kind: 'COLLECT', groupPayment,
    })
    await Payment.updateOne({ _id: payment._id }, { $set: { ...balanceAfter(payment, owed, owed), groupPayment } })
    return installment
}

const loadPayment = (id) => Payment.findById(id)
    .populate({ path: 'transactions', match: { isDeleted: false }, populate: [{ path: 'product', select: 'profile name', populate: [{ path: 'profile', select: 'filename' }, { path: 'category', select: 'hasThermalPrinting' }] }, { path: 'options', populate: 'property' }] })
    .populate('customer')
    .populate('createdBy', 'username')

// Money received for one Pay Later sale, oldest first
exports.installments = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Payment not found' }, res)
        const data = await PaymentInstallment.find({ payment: req.params.id }).sort({ paidAt: 1 }).populate('createdBy', 'username').lean()
        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._internal = { totalUSD, feeAmount, round2 }
