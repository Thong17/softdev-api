const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        ticket: {
            type: Number,
            require: true
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
        },
        isCompleted: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store',
            index: true
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
        this.tags = `${this.ticket}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Queue', schema)