const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        name: {
            type: String,
            default: 'SoftDev'
        },
        logo: {
            type: mongoose.Schema.ObjectId,
            ref: 'Icon'
        },
        type: {
            type: String,
            default: 'Restaurant'
        },
        font: {
            type: String,
            default: 'Arial'
        },
        tax: {
            type: Number,
            default: 0
        },
        contact: {
            type: String,
            default: '000-000-000'
        },
        other: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        transferMethods: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Transfer'
        }],
        updatedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Store', schema)