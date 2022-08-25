const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        filename: {
            type: String
        },
        isActive: {
            type: Boolean,
            default: false
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Picture', schema)