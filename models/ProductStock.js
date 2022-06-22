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

schema.post('save', async function () {
    const product = await Product.findOne({ _id: this.product._id })
    product.stocks.push(this._id)
    product.save()
})

module.exports = mongoose.model('ProductStock', schema)