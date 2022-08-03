const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        floor: {
            type: String,
            default: 'GF'
        },
        order: {
            type: Number,
            default: 0
        },
        column: {
            type: Array,
            default: [1]
        },
        row: {
            type: Array,
            default: [1]
        },
        structures: [{
            type: mongoose.Schema.ObjectId,
            ref: 'StoreStructure'
        }],
        mergedStructures: [{
            type: Object,
        }],
        updatedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        isDisabled: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            default: ''
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
        this.tags = `${this.floor}${this.description}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('StoreFloor', schema)