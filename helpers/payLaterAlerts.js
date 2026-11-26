// Pay Later overdue alerts: the bell (asked for live, see alertController) and
// a daily Telegram summary (Config › Telegram: on/off and the time to send).
const cron = require('node-cron')
const moment = require('moment')
const Payment = require('../models/Payment')
const StoreSetting = require('../models/StoreSetting')
const { sendMessageTelegram } = require('./utils')

// Dates and the send time follow the shop's clock (Cambodia), not the server's
const OFFSET = 7
const TIMEZONE = 'Asia/Phnom_Penh'
const DEFAULT_TIME = '08:00'
const MAX_LINES = 30

const localNow = (now = new Date()) => moment(now).utcOffset(OFFSET)
const today = (now) => localNow(now).format('YYYY-MM-DD')

const customerName = (customer) =>
    customer?.fullName || customer?.companyName || customer?.displayName || 'Walk-in'

// Owing Pay Later sales whose due date is before today (a sale due today is
// not overdue until tomorrow), oldest due first
const findOverduePayLater = async ({ limit = 0, now = new Date() } = {}) => {
    const startOfToday = localNow(now).startOf('day').toDate()
    const query = Payment.find({
        isPayLater: true,
        'balance.USD': { $gt: 0.01 },
        'payLater.dueDate': { $lt: startOfToday },
    })
        .select('invoice customer balance payLater.dueDate updatedAt')
        .populate('customer', 'fullName displayName companyName')
        .sort({ 'payLater.dueDate': 1, _id: 1 })
        .lean()
    if (limit) query.limit(limit)
    const todayDate = moment(today(now), 'YYYY-MM-DD')
    return (await query).map((payment) => {
        const due = localNow(payment.payLater.dueDate).format('YYYY-MM-DD')
        return {
            _id: payment._id,
            invoice: payment.invoice,
            customerName: customerName(payment.customer),
            customerPhone: payment.customer?.displayName || '',
            balance: Math.round((payment.balance?.USD || 0) * 100) / 100,
            dueDate: due,
            daysOverdue: todayDate.diff(moment(due, 'YYYY-MM-DD'), 'days'),
            updatedAt: payment.updatedAt,
        }
    })
}

// Telegram's Markdown: these characters in names would break the message
const escapeMarkdown = (text) => String(text ?? '').replace(/([_*`[\]])/g, '\\$1')

const money = (value) => `$${Number(value || 0).toFixed(2)}`

const telegramSummary = (items) => {
    const lines = items.slice(0, MAX_LINES).map((item) =>
        `• ${escapeMarkdown(item.invoice)} · ${escapeMarkdown(item.customerName)} · ${money(item.balance)} · due ${item.dueDate} (${item.daysOverdue} day${item.daysOverdue === 1 ? '' : 's'})`)
    if (items.length > MAX_LINES) lines.push(`…and ${items.length - MAX_LINES} more`)
    const total = items.reduce((sum, item) => sum + item.balance, 0)
    return [`⏰ *Pay Later overdue (${items.length})*`, '', ...lines, '', `💰 Total owed: ${money(total)}`].join('\n')
}

const validTime = (value) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : DEFAULT_TIME)

// What the schedule runs every few minutes. Sends today's summary once, after
// the configured time, when switched on and Telegram is set up. Returns what
// it did (for tests and logs); never throws.
const checkOverdueSummary = async (now = new Date(), send = sendMessageTelegram) => {
    try {
        const setting = await StoreSetting.findOne().lean()
        if (!setting?.telegramPrivilege?.SENT_PAY_LATER_OVERDUE) return 'off'
        if (!setting.telegramAPIKey || !setting.telegramChatID) return 'no telegram'
        if (localNow(now).format('HH:mm') < validTime(setting.payLaterOverdueTime)) return 'too early'
        const day = today(now)
        if (setting.payLaterOverdueSentOn === day) return 'already sent'
        // Claimed before sending: of two checks at once (or two API processes),
        // only the one that changes the date goes on
        const { modifiedCount } = await StoreSetting.updateOne(
            { _id: setting._id, payLaterOverdueSentOn: { $ne: day } },
            { $set: { payLaterOverdueSentOn: day } }
        )
        if (!modifiedCount) return 'already sent'
        const items = await findOverduePayLater({ now })
        if (!items.length) return 'none overdue'
        try {
            await send({ text: telegramSummary(items), token: setting.telegramAPIKey, chatId: setting.telegramChatID })
        } catch (err) {
            // Not sent (e.g. no connection): the next check tries again
            await StoreSetting.updateOne({ _id: setting._id, payLaterOverdueSentOn: day }, { $set: { payLaterOverdueSentOn: setting.payLaterOverdueSentOn || null } })
            throw err
        }
        return `sent ${items.length}`
    } catch (err) {
        console.error('Pay Later overdue summary failed', err?.response?.data || err)
        return 'error'
    }
}

let scheduled = false
const startPayLaterAlertSchedule = () => {
    if (scheduled) return
    scheduled = true
    // Every 5 minutes: sends once the configured time has passed, so a new
    // time applies the same day and a server that was down catches up
    cron.schedule('*/5 * * * *', () => { checkOverdueSummary() }, { timezone: TIMEZONE })
}

module.exports = { findOverduePayLater, telegramSummary, checkOverdueSummary, startPayLaterAlertSchedule, escapeMarkdown }
