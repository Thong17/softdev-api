const mongoose = require('mongoose')
const Icon = require('./Icon')

const schema = mongoose.Schema(
    {
        description: {
            type: String,
            default: ''
        },
        price: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        total: {
            type: Number,
            default: 0
        },
        quantity: {
            type: Number,
            default: 0
        },
        status: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        discount: {
            type: Object,
            default: {
                value: 0,
                type: 'PCT',
                isFixed: false
            }
        },
        options: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductOption'
        }],
        stocks: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
        }],
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        },
        promotion: {
            type: mongoose.Schema.ObjectId,
            ref: 'Promotion'
        },
        color: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductColor'
        },
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
        this.tags = `${this.description}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Transaction', schema)