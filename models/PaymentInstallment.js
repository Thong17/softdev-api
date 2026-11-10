const mongoose = require('mongoose')

// Money received towards a Pay Later sale: the deposit at checkout and every
// later collection (single or through a group payment)
const schema = mongoose.Schema(
    {
        payment: { type: mongoose.Schema.ObjectId, ref: 'Payment', required: true, index: true },
        customer: { type: mongoose.Schema.ObjectId, ref: 'Customer', index: true },
        // USD equivalent at the sale's rate
        amount: { type: Number, required: true },
        receiveCashes: { type: Array, default: [] },
        receiveTotal: { type: Object },
        returnCashes: { type: Array, default: [] },
        rate: { type: Object },
        // cash | transfer
        paymentMethod: { type: String, default: 'cash' },
        // DEPOSIT (at checkout) | COLLECT (later)
        kind: { type: String, default: 'COLLECT' },
        // Fee added to the balance with this collection (USD amount)
        fee: {
            value: { type: Number, default: 0 },
            type: { type: String, default: 'PCT' },
            amount: { type: Number, default: 0 },
        },
        // Its share of the items' cost (USD), fixed when recorded so later
        // fees never change past reports
        cost: { type: Number },
        drawer: { type: mongoose.Schema.ObjectId, ref: 'Drawer' },
        groupPayment: { type: mongoose.Schema.ObjectId, ref: 'GroupPayment' },
        createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
        paidAt: { type: Date, default: Date.now, index: true },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('PaymentInstallment', schema)
