const mongoose = require('mongoose')
const Icon = require('./Icon')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            required: true
        },
        legalName: {
            type: String,
            default: ''
        },
        status: {
            type: Boolean,
            default: true
        },
        contact: {
            type: String,
            default: ''
        },
        email: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        logo: {
            type: mongoose.Schema.ObjectId,
            ref: 'Icon'
        },
        stores: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Store'
        }],
        isDeleted: {
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
        this.tags = `${JSON.stringify(this.name)}${this.legalName}${this.contact}${this.email}${this.address}`.replace(/ /g, '')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Company', schema)
