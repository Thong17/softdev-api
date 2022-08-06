const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        description: {
            type: Object,
        },
        value: {
            type: Number,
            require: true
        },
        type: {
            type: String,
            require: true
        },
        isFixed: {
            type: Boolean,
            default: false
        },
        startAt: {
            type: Date,
        },
        expireAt: {
            type: Date,
            default: () => new Date(+new Date() + 1*24*60*60*1000)
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        products: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        }],
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Promotion', schema)