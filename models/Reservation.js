const mongoose = require('mongoose')
const Icon = require('./Icon')

const schema = mongoose.Schema(
    {
        startAt: {
            type: Date,
            default: Date.now
        },
        endAt: {
            type: Date,
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
        this.tags = `${JSON.stringify(this.name)}${this.description}`.replace(/ /g,'')
        if (this.icon) {
            await Icon.findOneAndUpdate({ _id: this.icon }, { isActive: false })
        }
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Reservation', schema)