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
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { reverseProductStock } = require('../helpers/utils')
const { failureMsg } = require('../constants/responseMsg')
const { RESET_GROUPS, resolveGroups, backupDatabase, resetGroups, hardReset, listBackups, restoreDatabase } = require('../helpers/dataReset')

exports.dumpMongoDB = async (req, res) => {
    try {
        const backup = await backupDatabase('manual')
        response.success(200, { msg: `Backup saved as ${backup.name}`, backup: backup.name }, res)
    } catch (err) {
        response.failure(500, { msg: err.message }, res, err)
    }
}

// Streams a compressed backup (mongodump --archive --gzip) to the browser, which
// saves it wherever the user picks. Restore with:
//   mongorestore --archive=<file> --gzip
exports.downloadBackup = (req, res) => {
    const mongoDumpPath = process.env.MONGO_DUMP_PATH
    if (!mongoDumpPath) return response.failure(500, { msg: 'Backup is not set up (MONGO_DUMP_PATH)' }, res)

    // Arguments are passed directly (no shell), so the URI is never parsed by one
    const dump = spawn(mongoDumpPath, [`--uri=${process.env.DATABASE_URL}`, '--archive', '--gzip'])
    let started = false
    let log = ''
    // mongodump reports progress on stderr; keep the tail for a failure message
    dump.stderr.on('data', (chunk) => { log = (log + chunk).slice(-2000) })

    // Headers go out with the first bytes, so a dump that fails at once can still answer with an error
    dump.stdout.once('data', (chunk) => {
        started = true
        res.status(200)
        res.setHeader('Content-Type', 'application/gzip')
        res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().replace(/:/g, '-')}.archive.gz"`)
        res.write(chunk)
        dump.stdout.pipe(res, { end: false })
    })
    // The error object carries the command line, URI and password included, so only its code is logged
    let failedToStart = false
    dump.on('error', (err) => {
        failedToStart = true
        console.error(`mongodump could not start (${err.code})`)
        if (!started) return response.failure(500, { msg: 'Mongo dump failed' }, res)
        res.destroy(new Error('Mongo dump failed'))
    })
    dump.on('close', (code) => {
        if (code === 0 && started) return res.end()
        if (!failedToStart) console.error(`mongodump exited with ${code}: ${log.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')}`)
        // Cut the connection on a failure part way, so the browser never keeps a broken file
        if (started) return res.destroy(new Error('Mongo dump failed'))
        if (!res.headersSent) response.failure(500, { msg: 'Mongo dump failed' }, res)
    })
    // Stop dumping if the browser goes away (e.g. the save is cancelled)
    res.on('close', () => { if (!res.writableFinished) dump.kill() })
}

// What a selective reset offers, for the Config page
exports.resetOptions = async (req, res) => {
    const groups = Object.entries(RESET_GROUPS).map(([key, group]) => ({ key, label: group.label, detail: group.detail, requires: group.requires }))
    response.success(200, { data: groups }, res)
}

// One reset or restore at a time; another request while one runs is refused
let dataBusy = false

// Backs up the database, then clears it: everything (hard) or the chosen groups.
// Nothing is deleted when the backup fails.
exports.resetData = async (req, res) => {
    const { mode, groups, confirm } = req.body || {}
    if (confirm !== 'RESET') return response.failure(422, { msg: 'Type RESET to confirm' }, res)
    if (!['hard', 'selective'].includes(mode)) return response.failure(422, { msg: 'Choose a hard or selective reset' }, res)
    const keys = mode === 'selective' ? resolveGroups(Array.isArray(groups) ? groups : []) : []
    if (mode === 'selective' && !keys.length) return response.failure(422, { msg: 'Choose what to reset' }, res)
    if (dataBusy) return response.failure(422, { msg: 'A reset or restore is already running' }, res)

    dataBusy = true
    try {
        let backup
        try {
            backup = await backupDatabase(mode === 'hard' ? 'before-hard-reset' : 'before-reset')
        } catch (err) {
            return response.failure(500, { msg: `Backup failed, so nothing was reset. ${err.message}` }, res, err)
        }
        const result = mode === 'hard' ? await hardReset() : await resetGroups(keys)
        response.success(200, { msg: `Reset done. Backup saved as ${backup.name}`, backup: backup.name, ...result }, res)
    } catch (err) {
        response.failure(500, { msg: `Reset stopped part way: ${err.message}. Restore the backup taken just before it.` }, res, err)
    } finally {
        dataBusy = false
    }
}

// Backups kept in the server's backup folder, newest first
exports.backupList = (req, res) => {
    try {
        const data = listBackups().map(({ name, kind, size, createdAt }) => ({ name, kind, size, createdAt }))
        response.success(200, { data }, res)
    } catch (err) {
        response.failure(500, { msg: 'Cannot read the backup folder' }, res, err)
    }
}

const runRestore = async (res, source, cleanup) => {
    if (dataBusy) {
        cleanup?.()
        return response.failure(422, { msg: 'A reset or restore is already running' }, res)
    }
    dataBusy = true
    try {
        const { safety } = await restoreDatabase(source)
        response.success(200, { msg: `Restored. The data from before was saved as ${safety}`, safety }, res)
    } catch (err) {
        response.failure(500, { msg: err.message, safety: err.safety }, res)
    } finally {
        dataBusy = false
        cleanup?.()
    }
}

// Restores one of the backups in the server's backup folder
exports.restoreFromServer = async (req, res) => {
    const { backup, confirm } = req.body || {}
    if (confirm !== 'RESTORE') return response.failure(422, { msg: 'Type RESTORE to confirm' }, res)
    // Only a name from the listing is accepted, never a path
    const source = listBackups().find((item) => item.name === backup)
    if (!source) return response.failure(404, { msg: 'That backup was not found' }, res)
    runRestore(res, source)
}

// Restores a backup file sent as the raw request body (application/octet-stream).
// The file is saved to a temporary file first, then checked and restored.
exports.restoreFromUpload = (req, res) => {
    if (req.headers['x-confirm'] !== 'RESTORE') return response.failure(422, { msg: 'Type RESTORE to confirm' }, res)
    if (dataBusy) return response.failure(422, { msg: 'A reset or restore is already running' }, res)
    const file = path.join(os.tmpdir(), `softdev-restore-${Date.now()}.archive.gz`)
    const cleanup = () => fs.rm(file, { force: true }, () => {})
    const out = fs.createWriteStream(file)
    req.pipe(out)
    req.on('aborted', () => { out.destroy(); cleanup() })
    out.on('error', (err) => {
        cleanup()
        if (!res.headersSent) response.failure(500, { msg: 'Cannot save the uploaded file' }, res, err)
    })
    out.on('finish', () => {
        if (!out.bytesWritten) {
            cleanup()
            return response.failure(422, { msg: 'The file is empty' }, res)
        }
        runRestore(res, { kind: 'archive', path: file }, cleanup)
    })
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