const mongoose = require('mongoose')
const crypto = require('node:crypto')

const schema = mongoose.Schema(
    {
        items: [{
            product: {
                type: mongoose.Schema.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                default: 1
            },
            options: [{
                type: mongoose.Schema.ObjectId,
                ref: 'ProductOption'
            }],
            note: {
                type: String,
                default: ''
            },
            status: {
                type: String,
                enum: ['PENDING', 'CONFIRMED', 'UNAVAILABLE'],
                default: 'PENDING'
            },
            unavailableReason: {
                type: String,
                default: ''
            },
        }],
        tableLabel: {
            type: String,
            default: ''
        },
        structure: {
            type: mongoose.Schema.ObjectId,
            ref: 'StoreStructure'
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer'
        },
        guestName: {
            type: String,
            default: ''
        },
        guestContact: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'],
            default: 'PENDING'
        },
        messages: [{
            from: {
                type: String,
                enum: ['STAFF', 'CUSTOMER'],
                required: true
            },
            text: {
                type: String,
                required: true
            },
            isRead: {
                type: Boolean,
                default: false
            },
            createdAt: {
                type: Date,
                default: Date.now
            },
        }],
        accessToken: {
            type: String,
            index: {
                unique: true
            }
        },
        transactions: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Transaction'
        }],
        acceptedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        isDeleted: {
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
        if (!this.accessToken) {
            this.accessToken = crypto.randomBytes(24).toString('hex')
        }
        this.tags = `${this.tableLabel}${this.guestName}${this.guestContact}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Order', schema)
