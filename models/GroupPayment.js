const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        invoice: {
            type: String
        },
        total: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        subtotal: {
            type: Object,
            default: {
                USD: 0,
                KHR: 0,
                BOTH: 0
            }
        },
        receiveCashes: {
            type: Array,
        },
        receiveTotal: {
            type: Object,
        },
        remainTotal: {
            type: Object,
        },
        returnCashes: {
            type: Array,
        },
        paymentMethod: {
            type: String,
            default: 'cash'
        },
        status: {
            type: Boolean,
            default: false
        },
        rate: {
            type: Object,
        },
        state: {
            type: String,
            default: 'PENDING'
        },
        drawer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Drawer'
        },
        payments: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
        }],
        transactions: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Transaction'
        }],
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

module.exports = mongoose.model('GroupPayment', schema)