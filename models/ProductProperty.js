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
        choice: {
            type: String,
            default: 'SINGLE'
        },
        isRequire: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            default: ''
        },
        options: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductOption'
        }],
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            require: true
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store',
            index: true
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

schema.statics.reorder = function (reorderedItems, storeId) {
    const promises = []
    for (let index = 0; index < reorderedItems.length; index++) {
        const item = reorderedItems[index];
        const promise = this.findOneAndUpdate({ _id: item._id, store: storeId }, { order: item.order }, { new: true })
        promises.push(promise)
    }
    Promise.all(promises)
}

module.exports = mongoose.model('ProductProperty', schema)