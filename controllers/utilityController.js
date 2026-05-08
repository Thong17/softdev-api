const StoreSetting = require('../models/StoreSetting')
const moment = require('moment')
const { sendMessageTelegram } = require('../helpers/utils')
const { currencyFormat } = require('../helpers/utils')

exports.sendTelegram = async (data) => {
    // Send message to Telegram
    const storeConfig = await StoreSetting.findOne()
    if (storeConfig?.telegramPrivilege?.SENT_AFTER_PAYMENT) {
        const text = exports.telegramReceiptTemplate(data)
        sendMessageTelegram({
            text,
            token: storeConfig.telegramAPIKey,
            chatId: storeConfig.telegramChatID,
        }).catch((err) => console.error(err))
    }
}

exports.telegramReceiptTemplate = (data) => {
    const message = `
🏪 *Restaurant Name*
📅 *Date: ${moment(data.createdAt).format('YYYY-MM-DD HH:mm:ss')}
🔢 *Invoice: #${data.invoice}
👤 *Cashier: ${data.createdBy?.username}

📋 *ITEMS*
━━━━━━━━━━━━━━━━━━━━
${data.transactions
    .map(
        (item, index) => `${index + 1}. ${item.description}  |  x${item.quantity}  |  $${item.total?.value?.toFixed(2)}`,
    )
    .join('\n')}

💵 *Subtotal: $${data.subtotal.BOTH.toFixed(2)}
💰 *TOTAL: $${data.total.value.toFixed(2)}
💳 *Payment: ${data.paymentMethod ?? 'Cash'}
`.trim()

    return message
}
