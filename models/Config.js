const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        theme: {
            type: String,
            default: 'light'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Config', schema)