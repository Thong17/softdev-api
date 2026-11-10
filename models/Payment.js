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
        rate: {
            type: Object,
        },
        status: {
            type: Boolean,
            default: false
        },
        state: {
            type: String,
            default: 'PENDING'
        },
        discounts: {
            type: Array,
        },
        vouchers: {
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
        reservation: {
            type: mongoose.Schema.ObjectId,
            ref: 'Reservation'
        },
        // Set when the sale was converted from a quotation
        quotation: {
            type: mongoose.Schema.ObjectId,
            ref: 'Quotation'
        },
        groupPayment: {
            type: mongoose.Schema.ObjectId,
            ref: 'GroupPayment'
        },
        // Pay Later: sold now, paid over time. Only sales checked out through
        // Pay Later have isPayLater; their revenue is counted from
        // PaymentInstallment as money arrives.
        isPayLater: {
            type: Boolean,
            default: false,
            index: true
        },
        // USD received so far (deposit + collections)
        paidTotal: {
            type: Number,
            default: 0
        },
        // Still owed, fee included
        balance: {
            USD: { type: Number, default: 0 },
            KHR: { type: Number, default: 0 },
        },
        payLater: {
            dueDate: { type: Date },
            note: { type: String },
            // One-time fee on the balance after the deposit; amount is in USD
            fee: {
                value: { type: Number, default: 0 },
                type: { type: String, default: 'PCT' },
                amount: { type: Number, default: 0 },
            },
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
        table: {
            type: String,
            default: ''
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