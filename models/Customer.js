const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        displayName: {
            type: String,
            require: true,
            index: {
                unique: true
            }
        },
        fullName: {
            type: String,
        },
        point: {
            type: Number,
            default: 0
        },
        contact: {
            type: String,
        },
        picture: {
            type: mongoose.Schema.ObjectId,
            ref: 'Picture'
        },
        dateOfBirth: {
            type: String,
        },
        address: {
            type: String,
        },
        // Business profile
        type: {
            type: String,
            enum: ['INDIVIDUAL', 'BUSINESS'],
            default: 'INDIVIDUAL'
        },
        companyName: { type: String },
        contactPerson: { type: String },
        taxId: { type: String },
        email: { type: String },
        telegram: { type: String },
        // RETAIL | WHOLESALE | VIP; `discount` (%) is applied to the invoice
        // when the customer is picked at cashing or in a quotation
        priceTier: {
            type: String,
            enum: ['RETAIL', 'WHOLESALE', 'VIP'],
            default: 'RETAIL'
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        // Tier earned by spending (helpers/customerTier.js). A locked tier was
        // chosen by staff and isn't changed automatically.
        tier: { type: mongoose.Schema.ObjectId, ref: 'CustomerTier' },
        tierLocked: { type: Boolean, default: false },
        // USD spent over the tier window at the last check
        tierSpent: { type: Number, default: 0 },
        tierCheckedAt: { type: Date },
        tierUpdatedAt: { type: Date },
        group: { type: String },
        source: { type: String },
        note: { type: String },
        // Picked on the map when the customer is created or edited
        location: {
            lat: { type: Number },
            lng: { type: Number },
            label: { type: String },
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        isDisabled: {
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

// Searchable text: phones, names, company, tax id, email, address
const customerTags = (customer) => [
    customer.displayName, customer.fullName, customer.contact, customer.companyName,
    customer.contactPerson, customer.taxId, customer.email, customer.telegram, customer.address,
].filter(Boolean).join('').replace(/ /g, '')

schema.statics.customerTags = customerTags

schema.pre('save', async function (next) {
    try {
        this.tags = customerTags(this)
        next()
    } catch (err) {
        next(err)
    }
})

module.exports = mongoose.model('Customer', schema)