const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        theme: {
            type: String,
            default: 'Light'
        },
        language: {
            type: String,
            default: 'English'
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Config', schema)