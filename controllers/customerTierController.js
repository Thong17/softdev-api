const Joi = require('joi')
const mongoose = require('mongoose')
const Customer = require('../models/Customer')
const CustomerTier = require('../models/CustomerTier')
const CustomerTierHistory = require('../models/CustomerTierHistory')
const StoreSetting = require('../models/StoreSetting')
const Icon = require('../models/Icon')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { listTiers, getMonths, runRecheck, customerStatus, evaluateCustomers } = require('../helpers/customerTier')

const saveTiersValidation = Joi.object({
    months: Joi.number().integer().min(1).max(120).required(),
    tiers: Joi.array().min(1).items(Joi.object({
        _id: Joi.string().optional().allow('', null),
        name: Joi.string().trim().max(40).required(),
        minSpent: Joi.number().min(0).required(),
        discount: Joi.number().min(0).max(100).required(),
        color: Joi.string().optional().allow(''),
        icon: Joi.string().valid('', 'bronze', 'silver', 'gold').optional(),
        iconImage: Joi.string().hex().length(24).optional().allow('', null),
    })).required(),
})

// Tiers lowest first, the spending window and how many customers each has
exports.list = async (req, res) => {
    try {
        const [tiers, months, counts, setting] = await Promise.all([
            listTiers(),
            getMonths(),
            Customer.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$tier', count: { $sum: 1 } } }]),
            StoreSetting.findOne().select('customerTierCheckedAt').lean(),
        ])
        const countOf = new Map(counts.map((item) => [String(item._id), item.count]))
        const data = tiers.map((tier) => ({ ...tier, customers: countOf.get(String(tier._id)) || 0 }))
        return response.success(200, { data: { tiers: data, months, checkedAt: setting?.customerTierCheckedAt || null } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Saves the whole tier list at once, then re-places every unlocked customer
exports.save = async (req, res) => {
    const { error, value } = saveTiersValidation.validate(req.body, { abortEarly: false, stripUnknown: true })
    if (error) return response.failure(422, extractJoiErrors(error), res)
    const { months, tiers } = value

    const names = tiers.map((tier) => tier.name.toLowerCase())
    if (new Set(names).size !== names.length) return response.failure(422, { msg: 'Tier names must be different' }, res)
    const amounts = tiers.map((tier) => tier.minSpent)
    if (new Set(amounts).size !== amounts.length) return response.failure(422, { msg: 'Each tier needs a different minimum spend' }, res)
    // Everyone belongs to a tier, so the lowest one starts at $0
    if (Math.min(...amounts) !== 0) return response.failure(422, { msg: 'The lowest tier must start at $0' }, res)

    try {
        const existing = await CustomerTier.find({ isDeleted: false }).lean()
        const keepIds = new Set(tiers.filter((tier) => tier._id).map((tier) => String(tier._id)))
        const unknown = [...keepIds].filter((id) => !existing.some((tier) => String(tier._id) === id))
        if (unknown.length) return response.failure(422, { msg: 'A tier no longer exists; reload and try again' }, res)

        for (const tier of tiers) {
            // An uploaded image replaces the built-in medal
            const body = { name: tier.name, minSpent: tier.minSpent, discount: tier.discount, color: tier.color || '#9e9e9e', icon: tier.iconImage ? '' : tier.icon || '', iconImage: tier.iconImage || null }
            if (tier._id) await CustomerTier.updateOne({ _id: tier._id }, { $set: body })
            else await CustomerTier.create({ ...body, createdBy: req.user?.id })
        }
        const removed = existing.filter((tier) => !keepIds.has(String(tier._id))).map((tier) => tier._id)
        if (removed.length) {
            await CustomerTier.updateMany({ _id: { $in: removed } }, { $set: { isDeleted: true } })
            // Customers locked on a removed tier go back to automatic
            await Customer.updateMany({ tier: { $in: removed } }, { $set: { tierLocked: false } })
        }
        await StoreSetting.updateOne({}, { $set: { customerTierMonths: months } }, { upsert: true })
        // Uploaded icons stay inactive until something uses them
        const iconIds = tiers.map((tier) => tier.iconImage).filter(Boolean)
        if (iconIds.length) await Icon.updateMany({ _id: { $in: iconIds } }, { $set: { isActive: true } })

        const result = await runRecheck({ mode: 'SETTINGS', userId: req.user?.id })
        return response.success(200, { msg: `Tiers saved. ${result.changed} customer${result.changed === 1 ? '' : 's'} changed tier.`, data: result }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.recalculate = async (req, res) => {
    try {
        const result = await runRecheck({ userId: req.user?.id })
        return response.success(200, { msg: `Re-checked ${result.checked} customers. ${result.changed} changed tier.`, data: result }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.status = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return response.failure(404, { msg: 'Customer not found' }, res)
        const data = await customerStatus(req.params.id)
        if (!data) return response.failure(404, { msg: 'Customer not found' }, res)
        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Locks a customer on a tier, or unlocks them back to automatic.
// Called by the customer create/update when `tierLocked`/`tier` are sent.
exports.applyTierChoice = async ({ customerId, tierLocked, tier, previous, userId }) => {
    if (tierLocked === undefined) return
    if (tierLocked) {
        const target = mongoose.Types.ObjectId.isValid(tier) ? await CustomerTier.findOne({ _id: tier, isDeleted: false }).lean() : null
        if (!target) throw Object.assign(new Error('Choose a tier to lock'), { code: 422 })
        await Customer.updateOne({ _id: customerId }, { $set: { tier: target._id, tierLocked: true, tierUpdatedAt: new Date() } })
        if (!previous?.tierLocked || String(previous?.tier) !== String(target._id)) {
            const from = previous?.tier ? await CustomerTier.findById(previous.tier).lean() : null
            await CustomerTierHistory.create({ customer: customerId, fromTier: from?._id, fromName: from?.name, toTier: target._id, toName: target.name, reason: 'MANUAL', createdBy: userId })
        }
        return
    }
    // Already automatic: saving the profile doesn't re-check the tier (that
    // only happens after payments and at the monthly re-check). A new customer
    // (no previous) is placed by the create itself.
    if (!previous?.tierLocked) return
    await Customer.updateOne({ _id: customerId }, { $set: { tierLocked: false } })
    // Back to automatic: placed by spending straight away
    await evaluateCustomers({ customerIds: [customerId], mode: 'UNLOCK', userId })
}
