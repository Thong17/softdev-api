const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        buyRate: {
            type: Number,
            require: true
        },
        sellRate: {
            type: Number,
            require: true
        },
        cashes: {
            type: Array,
        },
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Drawer', schema)