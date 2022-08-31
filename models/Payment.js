const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        invoice: {
            type: String
        },
        total: {
            type: Object,
        },
        subtotal: {
            type: Object,
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
        returnTotal: {
            type: Object,
        },
        returnCashes: {
            type: Array,
        },
        paymentMethod: {
            type: String,
            default: 'cash'
        },
        rate: {
            type: Object,
        },
        status: {
            type: Boolean,
            default: false
        },
        promotions: {
            type: Array,
        },
        services: {
            type: Array,
        },
        drawer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Drawer'
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer'
        },
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

module.exports = mongoose.model('Payment', schema)