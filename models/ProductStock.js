const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        extra: {
            type: Object,
            default: { value: 0, currency: 'USD' }
        },
        color: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductColor'
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

module.exports = mongoose.model('ProductStock', schema)