const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        title: {
            type: String,
        },
        image: {
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
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

module.exports = mongoose.model('Transfer', schema)