const mongoose = require('mongoose')
const Role = require('./Role')


const schema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true,
        },
        company: {
            type: mongoose.Schema.ObjectId,
            ref: 'Company',
            required: true,
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store',
            required: true,
        },
        role: {
            type: mongoose.Schema.ObjectId,
            ref: 'Role',
            required: [true, 'Role is required!'],
            validate: {
                validator: (id) => {
                    return new Promise((resolve, reject) => {
                        Role.findById(id, function (err, doc) {
                            if (err) return reject(err)
                            resolve(!!doc)
                        })
                    })
                },
                message: 'Role is not existed in our system'
            },
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.index({ user: 1, company: 1, store: 1 }, { unique: true })

module.exports = mongoose.model('UserStoreAccess', schema)
