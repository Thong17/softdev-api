const mongoose = require('mongoose')

const schema = mongoose.Schema(
    {
        telegramAPIKey: {
            type: String,
            default: ''
        },
        telegramChatID: {
            type: String,
            default: ''
        },
        telegramPrivilege: {
            type: Object,
            default: {
                SENT_AFTER_PAYMENT: false,
                SENT_AFTER_OPEN_DRAWER: false,
                SENT_AFTER_CLOSE_DRAWER: false,
            }
        },
        thermalPrinterName: {
            type: String,
            default: 'Gprinter GP-2270T'
        },
        thermalPrinterWidth: {
            type: Number,
            default: 52
        },
        thermalPrinterHeight: {
            type: Number,
            default: 126
        },
        thermalPrinterGap: {
            type: Number,
            default: 2
        },
        receiptPrinterName: {
            type: String,
            default: 'POS80 Printer'
        },
        receiptPrinterCharPerLine: {
            type: Number,
            default: 48
        },
        storePrinterName: {
            type: String,
            default: 'POS58'
        },
        storePrinterCharPerLine: {
            type: Number,
            default: 32
        },
        // Customer tiers: months of spending counted, and the last re-check
        customerTierMonths: {
            type: Number,
            default: 12
        },
        customerTierCheckedAt: {
            type: Date
        },
        // A4 / A5 invoices that can be printed or saved as PDF
        softInvoice: {
            enabled: { type: Boolean, default: false },
            paperSize: { type: String, enum: ['A4', 'A5'], default: 'A4' },
            showLogo: { type: Boolean, default: true },
            // Printed at the bottom, e.g. bank account or return policy
            footer: { type: String, default: '' },
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('StoreSetting', schema)