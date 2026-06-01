const StoreSetting = require('../models/StoreSetting')
const Payment = require('../models/Payment')
const Transaction = require('../models/Transaction')
const Reservation = require('../models/Reservation')
const StoreStructure = require('../models/StoreStructure')
const response = require('../helpers/response')
const Store = require('../models/Store')
const moment = require('moment')
const { sendMessageTelegram } = require('../helpers/utils')
const { currencyFormat } = require('../helpers/utils')
const mongoose = require('mongoose')
const { exec } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { reverseProductStock } = require('../helpers/utils')
const { failureMsg } = require('../constants/responseMsg')

exports.dumpMongoDB = async (req, res) => {
    try {
        const backupRoot = process.env.MONGO_BACKUP_PATH
        const mongoDumpPath = process.env.MONGO_DUMP_PATH

        /* create backup folder if not exists */
        if (!fs.existsSync(backupRoot)) {
            fs.mkdirSync(backupRoot, { recursive: true })
        }

        /* timestamp folder */
        const timestamp = new Date()
            .toISOString()
            .replace(/:/g, '-')

        const backupPath = path.join(backupRoot, timestamp)

        /* mongodb uri */
        const mongoUri = process.env.DATABASE_URL

        /* mongo_dump command */
        const command = `${mongoDumpPath} --uri="${mongoUri}" --out="${backupPath}"`

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(error)

                return response.failure(
                    500,
                    { msg: 'Mongo dump failed', error: error.message },
                    res
                )
            }

            response.success(
                200,
                {
                    msg: 'MongoDB backup completed',
                    backupPath
                },
                res
            )
        })
    } catch (err) {
        console.error(err)

        response.failure(
            500,
            { msg: err.message },
            res
        )
    }
}

exports.sendTelegram = async (data) => {
    // Send message to Telegram
    const storeConfig = await StoreSetting.findOne()
    if (storeConfig?.telegramPrivilege?.SENT_AFTER_PAYMENT) {
        const text = await exports.telegramReceiptTemplate(data)
        sendMessageTelegram({
            text,
            token: storeConfig.telegramAPIKey,
            chatId: storeConfig.telegramChatID,
        }).catch((err) => console.error(err))
    }
}

exports.telegramReceiptTemplate = async (data) => {
    const subtotalStr = `$${data.subtotal.BOTH.toFixed(2)}`;
    const totalStr = `$${data.total.value.toFixed(2)}`;
    const paymentStr = data.paymentMethod ?? 'Cash';
    const store = await Store.findOne({})

    const itemsList = (() => {
        const header = 'No.  Description          Qty    Price';
        const separator = '───  ───────────────────  ───  ────────';
        const rows = data.transactions.map(
            (item, index) => {
                const currencySymbol = item.total.currency === 'USD' ? '$' : '៛';
                const currencyPad = item.total.currency === 'USD' ? 2 : 0;
                const num = `${index + 1}.`.padEnd(4);
                const desc = item.description.length > 18 
                    ? (item.description.substring(0, 16) + '..').padEnd(19)
                    : item.description.padEnd(19);
                const qty = `x${item.quantity}`.padStart(3);
                const price = `${currencySymbol}${item.total?.value?.toFixed(currencyPad)}`.padStart(8);
                return `${num}  ${desc}  ${qty}  ${price}`;
            },
        );
        const footerSep = '───────────────────────────────';
        const subtotalLine = `Subtotal:              ${subtotalStr.padStart(8)}`;
        const totalLine = `Total:                 ${totalStr.padStart(8)}`;
        const paymentLine = `Payment:               ${paymentStr.padStart(8)}`;
        return [header, separator, ...rows, footerSep, subtotalLine, totalLine, paymentLine].join('\n');
    })();

    const formattedDate = moment(data.createdAt).utcOffset(7).format('YYYY/MM/DD hh:mm A');
    const maxLabelLen = Math.max('Restaurant Name'.length, 'Date'.length, 'Invoice'.length, 'Cashier'.length);
    const padHeader = (label) => `${label}:`.padEnd(maxLabelLen + 1);

    const message = `
📍  ${padHeader('Store')} ${store?.name || 'App'}
🕐  ${padHeader('Date')} ${formattedDate}
🧾  ${padHeader('Invoice')} #${data.invoice}
👨‍💼  ${padHeader('Cashier')} ${data.createdBy?.username}
\`\`\`
${itemsList}
\`\`\`
`.trim();

    return message
}

exports.clearTransactionAndPayment = async (req, res) => {
    try {
        let query = {}

        if (req.body.fromDate) {
            const fromDate = new Date(req.body.fromDate)
            query.createdAt = { ...query.createdAt, $gt: fromDate }
        }

        if (req.body.toDate) {
            const toDate = new Date(req.body.toDate)
            query.createdAt = { ...query.createdAt, $lt: toDate }
        }

        if (req.body.ids) {
            query._id = { $in: req.body.ids }
        }

        if (req.body.id) {
            query._id = req.body.id
        }

        const payments = await Payment.find(query).lean()

        if (payments.length === 0) {
            return response.failure(
                404,
                { msg: 'No payments found to be deleted!' },
                res
            )
        }

        /* get all transaction ids from payments */
        const transactionIds = payments.flatMap(
            p => p.transactions || []
        )

        const transactions = await Transaction.find({
            _id: { $in: transactionIds }
        }).lean()

        /* get all reservation ids from payments */
        const reservationIds = payments.map(
            p => p.reservation
        ).filter((v) => !!v)

        const reservations = await Reservation.find({
            _id: { $in: reservationIds }
        }).lean()

        /* get all structure ids from reservations */
        const structureIds = reservations.flatMap(r => r.structures || [])
        const structureUpdates = await StoreStructure.updateMany(
            { _id: { $in: structureIds } },
            { $set: { status: 'vacant' } }
        )

        const paymentBakCollection =
            mongoose.connection.collection('payment_bak')

        const transactionBakCollection =
            mongoose.connection.collection('transaction_bak')

        const reservationBakCollection =
            mongoose.connection.collection('reservation_bak')

        /* backup payments */
        if (payments.length > 0) {
            await paymentBakCollection.insertMany(
                payments.map(p => ({
                    ...p,
                    originalId: p._id,
                    deletedAt: new Date()
                }))
            )
        }

        /* backup transactions */
        if (transactions.length > 0) {
            await transactionBakCollection.insertMany(
                transactions.map(t => ({
                    ...t,
                    originalId: t._id,
                    deletedAt: new Date()
                }))
            )
        }

        /* backup reservations */
        if (reservations.length > 0) {
            await reservationBakCollection.insertMany(
                reservations.map(r => ({
                    ...r,
                    originalId: r._id,
                    deletedAt: new Date()
                }))
            )
        }

        /* delete transactions */
        await reverseProductStock(transactions?.flatMap(t => t.stocks || []))
            
        await Transaction.deleteMany({
            _id: { $in: transactionIds }
        })

        /* delete payments */
        await Payment.deleteMany({
            _id: { $in: payments.map(p => p._id) }
        })

        /* delete reservations */
        await Reservation.deleteMany({
            _id: { $in: reservationIds }
        })

        response.success(
            200,
            {
                paymentsDeleted: payments.length,
                transactionsDeleted: transactions.length,
                reservationsDeleted: reservations.length,
                structureUpdates: structureUpdates.modifiedCount
            },
            res
        )
    } catch (err) {
        console.error(err)
        response.failure(500, { msg: err.message }, res)
    }
}