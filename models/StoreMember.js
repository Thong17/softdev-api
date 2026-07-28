const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store',
            required: [true, 'Store is required!']
        },
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'User is required!']
        },
        role: {
            type: mongoose.Schema.ObjectId,
            ref: 'Role',
            required: [true, 'Role is required!']
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        isDisabled: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.index({ store: 1, user: 1 }, { unique: true })

schema.pre('save', async function (next) {
    try {
        this.tags = `${this.store}${this.user}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('StoreMember', schema)
