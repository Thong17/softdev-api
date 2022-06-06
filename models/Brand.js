const mongoose = require('mongoose')
const Icon = require('./Icon')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        status: {
            type: Boolean,
            default: false
        },
        icon: {
            type: mongoose.Schema.ObjectId,
            ref: 'Icon'
        },
        description: {
            type: String,
            default: ''
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        products: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        }],
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.post('save', async function () {
    await Icon.findOneAndUpdate({ _id: this.icon }, { isActive: true })
})

module.exports = mongoose.model('Brand', schema)