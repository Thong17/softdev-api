const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        photo: {
            type: mongoose.Schema.ObjectId,
            ref: 'Picture'
        },
        gender: {
            type: String
        },
        birthday: {
            type: Date
        },
        contact: {
            type: String
        },
        address: {
            type: String
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Profile', schema)