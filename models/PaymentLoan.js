const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        interest: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        overdue: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        prepayment: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        duration: {
            type: Object,
            default: {
                value: 1,
                time: 'month'
            }
        },
        attachment: {
            type: Array
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer'
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

schema.pre('save', async function (next) {
    try {
        this.tags = `${this.invoice}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('PaymentLoan', schema)