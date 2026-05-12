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
    const subtotalStr = `$${data.subtotal.BOTH.toFixed(2)}`;
    const totalStr = `$${data.total.value.toFixed(2)}`;
    const paymentStr = data.paymentMethod ?? 'Cash';

    const itemsList = (() => {
        const header = 'No.  Description          Qty    Price';
        const separator = '───  ───────────────────  ───  ────────';
        const rows = data.transactions.map(
            (item, index) => {
                const num = `${index + 1}.`.padEnd(4);
                const desc = item.description.substring(0, 18).padEnd(19);
                const qty = `x${item.quantity}`.padStart(3);
                const price = `$${item.total?.value?.toFixed(2)}`.padStart(8);
                return `${num}  ${desc}  ${qty}  ${price}`;
            },
        );
        const footerSep = '────────────────────────────────';
        const subtotalLine = `Subtotal:              ${subtotalStr.padStart(8)}`;
        const totalLine = `TOTAL:                 ${totalStr.padStart(8)}`;
        const paymentLine = `Payment:               ${paymentStr}`;
        return [header, separator, ...rows, footerSep, subtotalLine, totalLine, paymentLine].join('\n');
    })();

    const formattedDate = moment(data.createdAt).format('YYYY/MM/DD hh:mm A');
    const maxLabelLen = Math.max('Restaurant Name'.length, 'Date'.length, 'Invoice'.length, 'Cashier'.length);
    const padHeader = (label) => `${label}:`.padEnd(maxLabelLen + 1);

    const message = `
📍  ${padHeader('Store')} ${data?.storeName || 'Serey App'}
🕐  ${padHeader('Date')} ${formattedDate}
🧾  ${padHeader('Invoice')} #${data.invoice}
👨‍💼  ${padHeader('Cashier')} ${data.createdBy?.username}
\`\`\`
${itemsList}
\`\`\`
`.trim();

    return message
}
