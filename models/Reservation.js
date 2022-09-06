const mongoose = require('mongoose')
const Payment = require('./Payment')

const schema = mongoose.Schema(
    {
        startAt: {
            type: Date,
            default: Date.now
        },
        endAt: {
            type: Date,
        },
        price: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD',
                duration: '1h'
            }
        },
        note: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            default: 'reserved'
        },
        isCompleted: {
            type: Boolean,
            default: false
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer'
        },
        structures: [{
            type: mongoose.Schema.ObjectId,
            ref: 'StoreStructure'
        }],
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
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
        this.tags = `${this.startAt}${this.endAt}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

schema.post('save', async function () {
    const countPayment = await Payment.count()
    const invoice = 'INV' + countPayment.toString().padStart(5, '0')
    const payment = await Payment.create({ invoice, createdBy: this.createdBy })
    await this.model('Reservation').findOneAndUpdate({ _id: this.id }, { payment: payment.id })
})

module.exports = mongoose.model('Reservation', schema)