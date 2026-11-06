const mongoose = require('mongoose')

// Log of bundle stock converted into another product's stock, e.g. reams into
// sheets. It moves stock between products and is never counted as a sale.
const schema = mongoose.Schema(
    {
        fromProduct: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        toProduct: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        // Number of bundles taken from `fromProduct`
        quantity: {
            type: Number,
            required: true
        },
        // How many `toProduct` units one bundle makes
        ratio: {
            type: Number,
            required: true
        },
        producedQuantity: {
            type: Number,
            required: true
        },
        consumedStocks: [
            {
                stock: {
                    type: mongoose.Schema.ObjectId,
                    ref: 'ProductStock'
                },
                quantity: {
                    type: Number
                },
                cost: {
                    type: Number
                },
                currency: {
                    type: String
                },
            }
        ],
        createdStock: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
        },
        totalCost: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        isNewProduct: {
            type: Boolean,
            default: false
        },
        note: {
            type: String
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('StockConversion', schema)
