const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        cost: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        quantity: {
            type: Number,
            default: 0
        },
        code: {
            type: String,
            default: ''
        },
        expireAt: {
            type: Date,
        },
        alertAt: {
            type: Number,
            default: 0
        },
        color: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductColor'
        },
        options: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductOption',
        }],
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            require: true
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('ProductStock', schema)