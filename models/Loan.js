const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        customer: {
            type: String,
            require: true
        },
        attachments: {
            type: Array,
            default: []
        },
        duration: {
            type: Object,
        },
        interest: {
            type: Object,
        },
        overdue: {
            type: Object,
        },
        prepayment: {
            type: Object,
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Loan', schema)