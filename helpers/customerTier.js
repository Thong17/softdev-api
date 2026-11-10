// Customer tiers earned by spending.
// - Spending = USD paid over the last N months (StoreSetting.customerTierMonths,
//   default 12): completed sales except loan sales, plus paid loan installments.
// - Upgrades happen right after a payment; any change (up or down) happens at
//   the monthly re-check or when the tiers are edited.
// - Customers with `tierLocked` keep the tier staff gave them.
const mongoose = require('mongoose')
const cron = require('node-cron')
const Customer = require('../models/Customer')
const CustomerTier = require('../models/CustomerTier')
const CustomerTierHistory = require('../models/CustomerTierHistory')
const StoreSetting = require('../models/StoreSetting')

const DEFAULT_MONTHS = 12
// Every tier starts at 0% so no discount is given until the store sets one
const DEFAULT_TIERS = [
    { name: 'Bronze', minSpent: 0, discount: 0, color: '#cd7f32', icon: 'bronze' },
    { name: 'Silver', minSpent: 300, discount: 0, color: '#9ea7b3', icon: 'silver' },
    { name: 'Gold', minSpent: 1000, discount: 0, color: '#e6b422', icon: 'gold' },
]

const getMonths = async () => {
    const setting = await StoreSetting.findOne().select('customerTierMonths').lean()
    const months = Number(setting?.customerTierMonths)
    return months > 0 ? months : DEFAULT_MONTHS
}

const windowStart = (months, now = new Date()) => {
    const since = new Date(now)
    since.setMonth(since.getMonth() - months)
    return since
}

// Active tiers, lowest first
const listTiers = () => CustomerTier.find({ isDeleted: false }).sort({ minSpent: 1, createdAt: 1 }).populate('iconImage', 'filename').lean()

// The highest tier whose threshold the spend reaches
const pickTier = (spent, tiers) => {
    let picked = null
    tiers.forEach((tier) => {
        if (spent >= tier.minSpent) picked = tier
    })
    return picked || tiers[0] || null
}

const toUSD = (valuePath, currencyPath, ratePath) => ({
    $cond: [
        { $eq: [currencyPath, 'KHR'] },
        { $divide: [{ $ifNull: [valuePath, 0] }, { $ifNull: [ratePath, 4000] }] },
        { $ifNull: [valuePath, 0] },
    ],
})

// USD spent per customer since `since`, as a Map of customer id -> amount
const spentSince = async (since, customerIds) => {
    const Payment = mongoose.model('Payment')
    const LoanPayment = mongoose.model('LoanPayment')
    const customerMatch = customerIds ? { $in: customerIds.map((id) => new mongoose.Types.ObjectId(String(id))) } : { $ne: null }

    const PaymentInstallment = mongoose.model('PaymentInstallment')
    const [sales, installments, payLater] = await Promise.all([
        Payment.aggregate([
            { $match: { customer: customerMatch, status: true, paymentMethod: { $ne: 'loan' }, isPayLater: { $ne: true }, createdAt: { $gte: since } } },
            { $group: { _id: '$customer', spent: { $sum: toUSD('$total.value', '$total.currency', '$rate.buyRate') } } },
        ]),
        LoanPayment.aggregate([
            { $match: { isPaid: true, paymentDate: { $gte: since } } },
            { $lookup: { from: 'loans', localField: 'loan', foreignField: '_id', as: 'loan' } },
            { $unwind: '$loan' },
            { $match: { 'loan.customer': customerMatch } },
            { $lookup: { from: 'payments', localField: 'loan.payment', foreignField: '_id', as: 'payment' } },
            { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$loan.customer', spent: { $sum: toUSD('$totalAmount.value', '$totalAmount.currency', '$payment.rate.buyRate') } } },
        ]),
        // Pay Later: what was actually received
        PaymentInstallment.aggregate([
            { $match: { customer: customerMatch, paidAt: { $gte: since } } },
            { $group: { _id: '$customer', spent: { $sum: '$amount' } } },
        ]),
    ])

    const spent = new Map()
    ;[...sales, ...installments, ...payLater].forEach(({ _id, spent: amount }) => {
        const key = String(_id)
        spent.set(key, (spent.get(key) || 0) + amount)
    })
    return spent
}

const rankOf = (tierId, tiers) => tiers.findIndex((tier) => String(tier._id) === String(tierId))

// Re-evaluates customers. mode:
// - 'UPGRADE': only moves customers up (after a payment)
// - 'RECHECK' / 'SETTINGS' / 'INITIAL': moves up or down
// Locked customers only get their cached spend refreshed.
const evaluateCustomers = async ({ customerIds = null, mode = 'RECHECK', userId = null } = {}) => {
    const tiers = await listTiers()
    if (!tiers.length) return { changed: 0, checked: 0 }
    const months = await getMonths()
    const now = new Date()
    const spentMap = await spentSince(windowStart(months, now), customerIds)

    const filter = { isDeleted: false, ...(customerIds && { _id: { $in: customerIds } }) }
    const customers = await Customer.find(filter).select('tier tierLocked').lean()
    const updates = []
    const history = []
    customers.forEach((customer) => {
        const spent = Math.round((spentMap.get(String(customer._id)) || 0) * 100) / 100
        const set = { tierSpent: spent, tierCheckedAt: now }
        const currentRank = rankOf(customer.tier, tiers)
        if (!customer.tierLocked) {
            const target = pickTier(spent, tiers)
            const targetRank = rankOf(target?._id, tiers)
            const move = currentRank < 0 || (mode === 'UPGRADE' ? targetRank > currentRank : targetRank !== currentRank)
            if (target && move) {
                set.tier = target._id
                set.tierUpdatedAt = now
                const from = currentRank >= 0 ? tiers[currentRank] : null
                history.push({
                    customer: customer._id,
                    fromTier: from?._id,
                    fromName: from?.name,
                    toTier: target._id,
                    toName: target.name,
                    reason: currentRank < 0 && mode !== 'UPGRADE' ? 'INITIAL' : mode,
                    spent,
                    createdBy: userId,
                })
            }
        }
        updates.push({ updateOne: { filter: { _id: customer._id }, update: { $set: set } } })
    })
    // Bulk writes skip the save hooks, so the search tags stay as they are
    if (updates.length) await Customer.bulkWrite(updates)
    if (history.length) await CustomerTierHistory.insertMany(history)
    return { changed: history.length, checked: customers.length }
}

// Called after a sale or installment is paid. Never fails the payment.
const onPaymentCompleted = (customerId) => {
    if (!customerId) return Promise.resolve()
    return evaluateCustomers({ customerIds: [customerId], mode: 'UPGRADE' })
        .catch((err) => console.error('Customer tier update failed', err))
}

const runRecheck = async ({ mode = 'RECHECK', userId = null } = {}) => {
    const result = await evaluateCustomers({ mode, userId })
    await StoreSetting.updateOne({}, { $set: { customerTierCheckedAt: new Date() } })
    return result
}

// Tier spending and progress for one customer (customer page)
const customerStatus = async (customerId) => {
    const [customer, tiers, months] = await Promise.all([
        Customer.findById(customerId).select('tier tierLocked tierSpent tierCheckedAt discount').lean(),
        listTiers(),
        getMonths(),
    ])
    if (!customer) return null
    const spentMap = await spentSince(windowStart(months), [customerId])
    const spent = Math.round((spentMap.get(String(customerId)) || 0) * 100) / 100
    const rank = rankOf(customer.tier, tiers)
    const tier = rank >= 0 ? tiers[rank] : null
    const next = tiers.find((item) => item.minSpent > spent && rankOf(item._id, tiers) > rank) || null
    const history = await CustomerTierHistory.find({ customer: customerId }).sort({ createdAt: -1 }).limit(50).populate('createdBy', 'username').lean()
    return {
        tier,
        tierLocked: !!customer.tierLocked,
        spent,
        months,
        nextTier: next,
        toNext: next ? Math.round((next.minSpent - spent) * 100) / 100 : 0,
        // The customer's own discount wins over the tier's
        discount: customer.discount > 0 ? customer.discount : tier?.discount || 0,
        history,
        tiers,
    }
}

// First run: create the default tiers, keep staff-chosen price tiers by locking
// those customers, then place everyone else by their spending
const seedTiers = async () => {
    if (await CustomerTier.exists({})) return false
    const created = await CustomerTier.insertMany(DEFAULT_TIERS)
    const byName = Object.fromEntries(created.map((tier) => [tier.name, tier]))
    const legacy = { WHOLESALE: byName.Silver, VIP: byName.Gold }
    for (const [priceTier, tier] of Object.entries(legacy)) {
        const customers = await Customer.find({ isDeleted: false, priceTier, tier: null }).select('_id').lean()
        if (!customers.length) continue
        await Customer.updateMany({ _id: { $in: customers.map((item) => item._id) } }, { $set: { tier: tier._id, tierLocked: true, tierUpdatedAt: new Date() } })
        await CustomerTierHistory.insertMany(customers.map((item) => ({ customer: item._id, toTier: tier._id, toName: tier.name, reason: 'MANUAL' })))
    }
    await runRecheck({ mode: 'INITIAL' })
    return true
}

let scheduled = false
// Monthly re-check at 02:00 on the 1st. If the server was off then, the next
// start catches up.
const startTierSchedule = async () => {
    try {
        await seedTiers()
        const setting = await StoreSetting.findOne().select('customerTierCheckedAt').lean()
        const last = setting?.customerTierCheckedAt ? new Date(setting.customerTierCheckedAt) : null
        const now = new Date()
        if (!last || last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth()) {
            await runRecheck()
        }
    } catch (err) {
        console.error('Customer tier start-up check failed', err)
    }
    if (scheduled) return
    scheduled = true
    cron.schedule('0 2 1 * *', () => {
        runRecheck().catch((err) => console.error('Customer tier re-check failed', err))
    })
}

module.exports = {
    DEFAULT_TIERS,
    getMonths,
    listTiers,
    pickTier,
    spentSince,
    windowStart,
    evaluateCustomers,
    onPaymentCompleted,
    runRecheck,
    customerStatus,
    seedTiers,
    startTierSchedule,
}
