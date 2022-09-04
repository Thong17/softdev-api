const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        id: {
            type: String,
        },
        originId: {
            type: String,
        },
        merged: {
            type: Boolean,
        },
        price: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD',
                duration: '1h'
            }
        },
        isMain: {
            type: Boolean,
        },
        status: {
            type: String,
            default: 'vacant'
        },
        title: {
            type: String,
            default: 'GF'
        },
        length: {
            type: Number,
            default: 1
        },
        size: {
            type: String,
            default: 'small'
        },
        type: {
            type: String,
            default: 'blank'
        },
        direction: {
            type: String,
            default: 'row'
        },
        align: {
            type: String,
            default: 'center'
        },
        justify: {
            type: String,
            default: 'center'
        },
        description: {
            type: String,
            default: ''
        },
        floor: {
            type: mongoose.Schema.ObjectId,
            ref: 'StoreFloor'
        },
        reservations: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Reservation'
        }],
        updatedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        isDisabled: {
            type: Boolean,
            default: false
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
        this.tags = `${this.title}${this.length}${this.size}${this.type}${this.direction}${this.align}${this.justify}${this.description}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('StoreStructure', schema)