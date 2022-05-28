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
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Category', schema)