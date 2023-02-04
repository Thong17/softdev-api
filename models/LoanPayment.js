const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        totalAmount: {
            type: Object,
        },
        principalAmount: {
            type: Object,
        },
        principalBalance: {
            type: Object,
        },
        interestAmount: {
            type: Object,
        },
        receiveCashes: {
            type: Array,
        },
        receiveTotal: {
            type: Object,
        },
        extraCashes: {
            type: Array,
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
        dueDate: {
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