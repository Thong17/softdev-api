const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        role: {
            type: String,
            index: {
                unique: true
            },
            required: [true, 'Name is required!']
        },
        description: {
            type: String
        },
        privilege: {
            type: Object,
            required: [true, 'Privileges is required!']
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Roles', schema)