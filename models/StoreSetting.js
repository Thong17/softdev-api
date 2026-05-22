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
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('StoreSetting', schema)