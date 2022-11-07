const mongoose = require('mongoose')
const Image = require('./Image')

const schema = mongoose.Schema(
    {
        name: {
            type: Object,
            require: true
        },
        price: {
            type: Number,
            require: true
        },
        currency: {
            type: String,
            require: true
        },
        code: {
            type: String,
            default: ''
        },
        status: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            default: ''
        },
        isStock: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        profile: {
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        brand: {
            type: mongoose.Schema.ObjectId,
            ref: 'Brand'
        },
        category: {
            type: mongoose.Schema.ObjectId,
            ref: 'Category'
        },
        promotion: {
            type: mongoose.Schema.ObjectId,
            ref: 'Promotion'
        },
        detail: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductDetail'
        },
        colors: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductColor'
        }],
        customers: [{
            type: mongoose.Schema.ObjectId,
            ref: 'CustomerOption'
        }],
        options: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductOption'
        }],
        properties: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductProperty'
        }],
        stocks: [{
            type: mongoose.Schema.ObjectId,
            ref: 'ProductStock',
        }],
        images: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Image'
        }],
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
        this.tags = `${JSON.stringify(this.name)}${this.description}${this.code}`.replace(/ /g,'')
        next()
    } catch (err) {
        next(err)
    }
})

schema.pre('findOneAndUpdate', async function (next) {
    try {
        const Product = await this.model.findById(this._conditions._id).populate('images')
        const updatedImageIds = this._update.images?.map((image) => image._id)
        const removedImageIds = []
        Product.images?.forEach(image => {
            const id = image._id.toString()
            if (!updatedImageIds?.includes(id)) {
                removedImageIds?.push(id)
            }
        })
        await Image.updateMany({ _id: { $in: removedImageIds } }, { $set: { isActive: false } }, { multi:true })
        await Image.updateMany({ _id: { $in: updatedImageIds } }, { $set: { isActive: true } }, { multi:true })
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Product', schema)