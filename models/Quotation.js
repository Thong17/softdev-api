const mongoose = require('mongoose')

// A priced quote prepared for a customer. Unlike a Payment it never creates
// Transactions, so building or saving a quotation does not touch stock.
const schema = mongoose.Schema(
    {
        // Named `invoice` so `generateInvoice` can number it
        invoice: {
            type: String
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'Customer'
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.ObjectId,
                    ref: 'Product'
                },
                description: {
                    type: String
                },
                price: {
                    type: Number,
                    default: 0
                },
                currency: {
                    type: String,
                    default: 'USD'
                },
                quantity: {
                    type: Number,
                    default: 1
                },
                discount: {
                    type: Object,
                    default: { value: 0, type: 'PCT', isFixed: false }
                },
                total: {
                    type: Object,
                    default: { value: 0, currency: 'USD' }
                },
                profile: {
                    type: String
                },
                note: {
                    type: String
                },
                // Kept so converting to cashing takes stock from the right batches
                color: {
                    type: mongoose.Schema.ObjectId,
                    ref: 'ProductColor'
                },
                options: [{
                    type: mongoose.Schema.ObjectId,
                    ref: 'ProductOption'
                }],
                customerOption: {
                    type: mongoose.Schema.ObjectId,
                    ref: 'CustomerOption'
                },
            }
        ],
        // The quoted prices are honoured until this date
        expireAt: {
            type: Date
        },
        // DRAFT until a cashing payment is created from it; CONVERTED is locked
        status: {
            type: String,
            enum: ['DRAFT', 'CONVERTED'],
            default: 'DRAFT'
        },
        payment: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
        },
        convertedAt: {
            type: Date
        },
        convertedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        discounts: {
            type: Array,
        },
        vouchers: {
            type: Array,
        },
        services: {
            type: Array,
        },
        subtotal: {
            type: Object,
            default: {
                USD: 0,
                KHR: 0,
                BOTH: 0
            }
        },
        total: {
            type: Object,
            default: {
                value: 0,
                currency: 'USD'
            }
        },
        rate: {
            type: Object,
        },
        note: {
            type: String,
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('Quotation', schema)
