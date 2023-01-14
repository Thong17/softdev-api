const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        receiveCashes: {
            type: Array,
        },
        receiveTotal: {
            type: Object,
        },
        returnCashes: {
            type: Array,
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        loan: {
            type: mongoose.Schema.ObjectId,
            ref: 'Loan'
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        duaDate: {
            type: Date
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('LoanPayment', schema)