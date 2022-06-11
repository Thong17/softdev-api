const mongoose = require('mongoose')
const Product = require('./Product')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        description: {
            type: String,
            default: ''
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
    product.properties.push(this._id)
    product.save()
})

module.exports = mongoose.model('ProductProperty', schema)