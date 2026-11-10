// Revenue from Pay Later sales is counted as money arrives: each
// PaymentInstallment is income on its paidAt date. Its cost is the matching
// share of the items' cost: amount ÷ (sale total + fee), so the fee itself
// carries no cost. Cash / Transfer / Loan sales are not affected.
const PaymentInstallment = require('../models/PaymentInstallment')

const toUSD = (value, currency, rate) => {
    const amount = Number(value) || 0
    return currency && currency !== 'USD' ? amount / (rate?.buyRate || rate?.sellRate || 4000) : amount
}

const itemsCostUSD = (payment) => (payment?.transactions || []).reduce((sum, transaction) => (
    sum + (transaction?.stockCosts || []).reduce((acc, stock) => acc + toUSD(stock.cost, stock.currency, payment.rate), 0)
), 0)

// What the customer owes in total for a Pay Later sale, in USD
const owedUSD = (payment) => toUSD(payment?.total?.value, payment?.total?.currency, { buyRate: payment?.rate?.sellRate || payment?.rate?.buyRate }) + (payment?.payLater?.fee?.amount || 0)

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
        const owed = owedUSD(installment.payment)
        const share = owed > 0 ? installment.amount / owed : 0
        const cost = itemsCostUSD(installment.payment) * share
        return { ...installment, income: installment.amount, cost, profit: installment.amount - cost }
    })
}

module.exports = { installmentsBetween, itemsCostUSD, owedUSD }
