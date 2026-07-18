const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        title: {
            type: String,
            require: true
        },
        description: {
            type: String,
            require: true
        },
        type: {
            type: String,
            enum: ['INFO', 'EXPIRE', 'PROMOTION', 'OUT_OF_STOCK'],
            default: 'INFO'
        },
        isRead: {
            type: Boolean,
            default: false
        },
        isPopup: {
            type: Boolean,
            default: false
        },
        stock: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock'
        },
        company: {
            type: mongoose.Schema.ObjectId,
            ref: 'Company'
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Notification', schema)