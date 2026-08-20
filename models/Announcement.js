const mongoose = require('mongoose')
const Icon = require('./Icon')

const schema = mongoose.Schema(
    {
        title: {
            type: Object,
            require: true
        },
        description: {
            type: Object,
        },
        banner: {
            type: mongoose.Schema.ObjectId,
            ref: 'Icon'
        },
        status: {
            type: Boolean,
            default: false
        },
        startAt: {
            type: Date,
        },
        expireAt: {
            type: Date,
            default: () => new Date(+new Date() + 1*24*60*60*1000)
        },
        order: {
            type: Number,
            default: 0
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

schema.pre('save', async function (next) {
    try {
        this.tags = `${JSON.stringify(this.title)}${JSON.stringify(this.description)}`.replace(/ /g,'')
        if (this.banner) {
            await Icon.findOneAndUpdate({ _id: this.banner }, { isActive: false })
        }
        next()
    } catch (err) {
        next(err)
    }
})

schema.post('save', async function () {
    await Icon.findOneAndUpdate({ _id: this.banner }, { isActive: true })
})

module.exports = mongoose.model('Announcement', schema)
