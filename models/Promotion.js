const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        description: {
            type: Object,
        },
        value: {
            type: Number,
            require: true
        },
        type: {
            type: String,
            require: true
        },
        isFixed: {
            type: Boolean,
            default: false
        },
        startAt: {
            type: Date,
        },
        expireAt: {
            type: Date,
            default: () => new Date(+new Date() + 1*24*60*60*1000)
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        products: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        }],
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.pre('save', async function (next) {
    try {
        this.tags = `${JSON.stringify(this.description)}${this.value}${this.type}${this.startAt}${this.expireAt}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Promotion', schema)