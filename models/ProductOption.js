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
    const product = await Product.findOne({ _id: this.product._id })
    product.options.push(this._id)
    product.save()

    const property = await ProductProperty.findOne({ _id: this.property._id })
    property.options.push(this._id)
    property.save()
})

module.exports = mongoose.model('ProductOption', schema)