const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        displayName: {
            type: String,
            require: true,
            index: {
                unique: true
            }
        },
        fullName: {
            type: String,
        },
        point: {
            type: Number,
            default: 0
        },
        contact: {
            type: String,
        },
        picture: {
            type: mongoose.Schema.ObjectId,
            ref: 'Picture'
        },
        dateOfBirth: {
            type: String,
        },
        address: {
            type: String,
        },
        isDeleted: {
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

schema.pre('save', async function (next) {
    try {
        this.tags = `${this.displayName}${this.fullName}${this.contact}${this.address}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Customer', schema)