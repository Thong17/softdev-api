const StoreSetting = require('../models/StoreSetting')
const moment = require('moment')
const { sendMessageTelegram } = require('../helpers/utils')
const { currencyFormat } = require('../helpers/utils')

exports.sendTelegram = async (data) => {
    // Send message to Telegram
    const storeConfig = await StoreSetting.findOne()
    if (storeConfig?.telegramPrivilege?.SENT_AFTER_PAYMENT) {
        const text = `New Payment On ${moment(data.createdAt).format('YYYY-MM-DD')}
            🧾Invoice: ${data.invoice}
            💵Subtotal: ${currencyFormat(data.subtotal.BOTH)} USD
            💵Total: ${currencyFormat(data.total.value)} ${data.total.currency}
            👝Payment Method: ${paymentMethod}
            👱‍♂️By: ${req.user?.username}
            `
        sendMessageTelegram({ text, token: storeConfig.telegramAPIKey, chatId: storeConfig.telegramChatID })
            .catch(err => console.error(err))
    }
}