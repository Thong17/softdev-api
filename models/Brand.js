const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        status: {
            type: Boolean,
            default: false
        },
        icon: {
            type: Object,
            require: false
        },
        description: {
            type: String,
            default: ''
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Brand', schema)