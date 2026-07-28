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
        type: {
            type: String,
            enum: ['REPOSSESSION', 'CLEARANCE']
        },
        transaction: {
            type: mongoose.Schema.ObjectId,
            ref: 'Transaction'
        },
        newStock: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
        },
        loan: {
            type: mongoose.Schema.ObjectId,
            ref: 'Loan'
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store',
            index: true
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