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
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
module.exports = mongoose.model('Activity', schema)