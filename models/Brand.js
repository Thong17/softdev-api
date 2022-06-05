const mongoose = require('mongoose')
const Image = require('./Image')

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
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        },
        description: {
            type: String,
            default: ''
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.post('save', async function () {
    await Image.findOneAndUpdate({ _id: this.icon }, { isActive: true })
})

module.exports = mongoose.model('Brand', schema)