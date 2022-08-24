const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        lastName: {
            type: String,
            require: true
        },
        firstName: {
            type: String,
            require: true
        },
        phone: {
            type: String,
            require: true
        },
        dateOfBirth: {
            type: String,
        },
        address: {
            type: String,
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.pre('save', async function (next) {
    try {
        this.tags = `${this.lastName}${this.firstName}${this.phone}${this.address}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Customer', schema)