const mongoose = require('mongoose')

// A customer level earned by spending, e.g. Bronze / Silver / Gold.
// Customers whose spend over the tier window reaches `minSpent` (USD) get it,
// and `discount` (%) is applied to their invoices.
const schema = mongoose.Schema(
    {
        name: { type: String, required: true },
        minSpent: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0, max: 100 },
        color: { type: String, default: '#9e9e9e' },
        // Medal shown with the tier: bronze | silver | gold, or none
        icon: { type: String, enum: ['', 'bronze', 'silver', 'gold'], default: '' },
        // Uploaded image used instead of a built-in medal
        iconImage: { type: mongoose.Schema.ObjectId, ref: 'Icon' },
        isDeleted: { type: Boolean, default: false },
        createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('CustomerTier', schema)
