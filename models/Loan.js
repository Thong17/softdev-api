const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        customer: {
            type: String,
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
        actualPaid: {
            type: Array,
            default: []
        },
        totalPaid: {
            type: Array,
            default: []
        },
        totalRemain: {
            type: Array,
            default: []
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
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