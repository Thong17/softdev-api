const mongoose = require('mongoose')

const discountSchema = mongoose.Schema({
    type: {
        type: String,
        enum: ['product', 'category', 'brand'],
        required: true
    },
    target: {
        type: mongoose.Schema.ObjectId,
        required: true,
        refPath: 'discounts.type'
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
        default: 'percentage'
    },
    value: {
        type: Number,
        required: true,
        min: 0
    }
})

const schema = mongoose.Schema(
    {
        description: {
            type: Object,
            required: true
        },
        discounts: [discountSchema],
        startAt: {
            type: Date,
            required: true
        },
        expireAt: {
            type: Date,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        note: {
            type: String,
            default: ''
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        tags: {
            type: String
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

// Index for efficient discount lookup
schema.index({ isActive: 1, startAt: 1, expireAt: 1, isDeleted: 1 })

schema.pre('save', async function (next) {
    try {
        this.tags = `${JSON.stringify(this.description)}${JSON.stringify(this.discounts)}`.replace(/ /g, '')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Membership', schema)