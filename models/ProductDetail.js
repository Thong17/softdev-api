const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        size: {
            type: String,
        },
        width: {
            type: String,
        },
        height: {
            type: String,
        },
        depth: {
            type: String,
        },
        weight: {
            type: String,
        },
        shape: {
            type: String,
        },
        material: {
            type: String,
        },
        style: {
            type: String,
        },
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

module.exports = mongoose.model('ProductDetail', schema)