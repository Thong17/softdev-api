const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        totalAmount: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
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
        isPaid: {
            type: Boolean,
            default: false
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