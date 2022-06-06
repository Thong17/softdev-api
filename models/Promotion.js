const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        description: {
            type: Object,
            require: true
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
        expireAt: {
            type: Date,
            default: () => new Date(+new Date() + 1*24*60*60*1000)
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