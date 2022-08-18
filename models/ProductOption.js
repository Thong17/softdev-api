const mongoose = require('mongoose')
const Product = require('./Product')
const ProductProperty = require('./ProductProperty')

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
        isDefault: {
            type: Boolean,
            default: false
        },
        property: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductProperty',
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
    const product = await Product.findById(this.product._id)
    await Product.findByIdAndUpdate(this.product._id, { options: [...product.options, this._id] })

    const property = await ProductProperty.findById(this.property._id)
    await ProductProperty.findByIdAndUpdate(this.property._id, { options: [...property.options, this._id] })
})

module.exports = mongoose.model('ProductOption', schema)