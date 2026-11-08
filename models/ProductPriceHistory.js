const mongoose = require('mongoose')

// One row per selling-price change made while adding, editing or converting
// stock, with the batch cost at the time for reference
const schema = mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        oldPrice: { type: Number },
        oldCurrency: { type: String },
        newPrice: { type: Number, required: true },
        newCurrency: { type: String, required: true },
        cost: { type: Number },
        costCurrency: { type: String },
        // STOCK_CREATE | STOCK_UPDATE | CONVERSION
        source: { type: String },
        stock: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
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

module.exports = mongoose.model('ProductPriceHistory', schema)
