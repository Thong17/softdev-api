const mongoose = require('mongoose')
const Product = require('./Product')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        price: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        profile: {
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        },
        description: {
            type: String,
            default: ''
        },
        property: {
            type: mongoose.Schema.ObjectId,
            ref: 'Property',
            require: true
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

schema.post('save', async function () {
    const product = await Product.findOne({ _id: this.product._id })
    product.options.push(this._id)
    product.save()
})

module.exports = mongoose.model('ProductOption', schema)