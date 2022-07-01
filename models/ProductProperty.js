const mongoose = require('mongoose')
const Product = require('./Product')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        order: {
            type: Number,
            default: 0
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

schema.statics.reorder = function (reorderedItems) {
    const promises = []
    for (let index = 0; index < reorderedItems.length; index++) {
        const item = reorderedItems[index];
        const promise = this.findByIdAndUpdate(item._id, { order: item.order }, { new: true })
        promises.push(promise)
    }
    Promise.all(promises)
}

module.exports = mongoose.model('ProductProperty', schema)