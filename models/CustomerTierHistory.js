const mongoose = require('mongoose')

// Every change of a customer's tier. Names are copied so the history still
// reads correctly after a tier is renamed or removed.
const schema = mongoose.Schema(
    {
        customer: { type: mongoose.Schema.ObjectId, ref: 'Customer', required: true, index: true },
        fromTier: { type: mongoose.Schema.ObjectId, ref: 'CustomerTier' },
        fromName: { type: String },
        toTier: { type: mongoose.Schema.ObjectId, ref: 'CustomerTier' },
        toName: { type: String },
        // UPGRADE (after a payment) | RECHECK (monthly) | SETTINGS (tiers edited)
        // | INITIAL (first assignment) | MANUAL (locked by staff) | UNLOCK
        reason: { type: String },
        // USD spent over the tier window when the change was made
        spent: { type: Number },
        createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('CustomerTierHistory', schema)
