const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        name: {
            type: String,
            require: true
        },
        cashes: {
            type: Array,
        },
        store: {
            type: mongoose.Schema.ObjectId,
            ref: 'Store'
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
        this.tags = `${this.name}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('PresetCash', schema)