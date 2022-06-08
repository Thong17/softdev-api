const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        price: {
            type: String,
            require: true
        },
        currency: {
            type: String,
            require: true
        },
        code: {
            type: String,
            default: ''
        },
        status: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            default: ''
        },
        isStock: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        profile: {
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        brand: {
            type: mongoose.Schema.ObjectId,
            ref: 'Brand'
        },
        category: {
            type: mongoose.Schema.ObjectId,
            ref: 'Category'
        },
        promotion: {
            type: mongoose.Schema.ObjectId,
            ref: 'Promotion'
        },
        detail: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductDetail'
        },
        colors: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductColor'
        }],
        options: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductOption'
        }],
        stocks: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
        }],
        images: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        }]
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Product', schema)