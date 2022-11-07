const mongoose = require('mongoose')
const Product = require('./Product')

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
        totalQuantity: {
            type: Number,
            default: 0
        },
        remain: {
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
        customers: [{
            type: mongoose.Schema.ObjectId,
            ref: 'CustomerOption',
        }],
        transactions: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Transaction',
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

schema.post('insertMany', function (doc) {
    doc.forEach(async stock => {
        const product = await Product.findOne({ _id: stock.product._id })
        if (product.stocks?.indexOf(stock._id) > -1) return
        product.stocks?.push(stock._id)
        product.save()
    });
})

schema.post('save', async function () {
    const product = await Product.findOne({ _id: this.product._id })
    product.stocks.push(this._id)
    product.save()
})

module.exports = mongoose.model('ProductStock', schema)