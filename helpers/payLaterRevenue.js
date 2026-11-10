// Revenue from Pay Later sales is counted as money arrives: each
// PaymentInstallment is income on its paidAt date. Its cost is saved when it's
// recorded: the items' cost not yet counted × amount ÷ what was owed just
// before, so fees carry no cost and the costs add up to the items' cost.
// Installments saved before that use amount ÷ everything owed.
// Cash / Transfer / Loan sales are not affected.
const PaymentInstallment = require('../models/PaymentInstallment')

const toUSD = (value, currency, rate) => {
    const amount = Number(value) || 0
    return currency && currency !== 'USD' ? amount / (rate?.buyRate || rate?.sellRate || 4000) : amount
}

const itemsCostUSD = (payment) => (payment?.transactions || []).reduce((sum, transaction) => (
    sum + (transaction?.stockCosts || []).reduce((acc, stock) => acc + toUSD(stock.cost, stock.currency, payment.rate), 0)
), 0)

// What the customer owes in total for a Pay Later sale, in USD
const owedUSD = (payment) => toUSD(payment?.total?.value, payment?.total?.currency, { buyRate: payment?.rate?.sellRate || payment?.rate?.buyRate }) + (payment?.payLater?.fee?.amount || 0) + (payment?.payLater?.collectFees || 0)

// Cost of an installment saved without one
const fallbackCost = (installment, payment, itemsCost) => {
    const owed = owedUSD(payment)
    return owed > 0 ? itemsCost * (installment.amount / owed) : 0
}

// Share of the items' cost for a new installment of `amount`, when `due` was
// owed just before it
const installmentCost = async (payment, amount, due) => {
    const Transaction = require('../models/Transaction')
    const ids = (payment?.transactions || []).map((item) => item?._id || item)
    const transactions = await Transaction.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).select('stockCosts').lean()
    const itemsCost = itemsCostUSD({ transactions, rate: payment.rate })
    const previous = await PaymentInstallment.find({ payment: payment._id }).select('amount cost').lean()
    const counted = previous.reduce((sum, item) => sum + (typeof item.cost === 'number' ? item.cost : fallbackCost(item, payment, itemsCost)), 0)
    const left = Math.max(0, itemsCost - counted)
    return due > 0 ? left * Math.min(1, amount / due) : 0
}

// Installments paid in a date range, with their income and cost in USD
const installmentsBetween = async (dateFilter, extra = {}) => {
    const installments = await PaymentInstallment.find({ paidAt: dateFilter, ...extra })
        .populate({
            path: 'payment',
            select: 'invoice total rate payLater transactions customer paymentMethod',
            populate: [
                { path: 'transactions', select: 'stockCosts', match: { isDeleted: { $ne: true } } },
                { path: 'customer', select: 'displayName fullName' },
            ],
        })
        .populate('createdBy', 'username')
        .lean()
    return installments.map((installment) => {
        const cost = typeof installment.cost === 'number'
            ? installment.cost
            : fallbackCost(installment, installment.payment, itemsCostUSD(installment.payment))
        return { ...installment, income: installment.amount, cost, profit: installment.amount - cost }
    })
}

module.exports = { installmentsBetween, itemsCostUSD, owedUSD, installmentCost }
