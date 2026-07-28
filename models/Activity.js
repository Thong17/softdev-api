const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        endpoint: {
            type: String,
            require: true
        },
        body: {
            type: Object,
            default: {}
        },
        method: {
            type: String,
            require: true
        },
        status: {
            type: Number,
            default: null
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
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
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * +(process.env.AUDIT_LOG_EXPIRATION_DAYS ?? 90) })
module.exports = mongoose.model('Activity', schema)