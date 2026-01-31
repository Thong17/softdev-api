const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        description: {
            type: String,
            default: ''
        },
        amount: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        note: {
            type: String,
        },
        transaction: {
            type: mongoose.Schema.ObjectId,
            ref: 'Transaction'
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('TransactionClearance', schema)