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
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

module.exports = mongoose.model('StoreSetting', schema)