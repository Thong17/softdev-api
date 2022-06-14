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
        code: {
            type: String,
            default: ''
        },
        profile: {
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        },
        images: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
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
    product.colors.push(this._id)
    product.save()
})

module.exports = mongoose.model('ProductColor', schema)