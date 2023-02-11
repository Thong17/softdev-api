const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer',
            require: true
        },
        attachments: {
            type: Array,
            default: []
        },
        interest: {
            type: Object,
            default: {
                value: 0,
                currency: 'PCT'
            }
        },
        overdue: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD',
                duration: { value: 7, time: 'day' }
            }
        },
        prepayment: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD',
                duration: { value: 7, time: 'day' }
            }
        },
        duration: {
            type: Object,
            default: {
                value: 1,
                time: 'month'
            }
        },
        status: {
            type: String,
            default: 'PENDING'
        },
        totalPaid: {
            type: Object,
            default: {
                KHR: 0,
                USD: 0,
                total: 0
            }
        },
        totalLoan: {
            type: Object,
            default: {
                USD: 0,
                KHR: 0,
            }
        },
        loanPayments: [{
            type: mongoose.Schema.ObjectId,
            ref: 'LoanPayment'
        }],
        actualPaid: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        totalRemain: {
            type: Object,
            default: {
                USD: 0,
                KHR: 0,
            }
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment',
            require: true
        },
        paymentObj: {
            type: Object,
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Loan', schema)