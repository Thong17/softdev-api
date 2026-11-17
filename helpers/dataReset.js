const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const zlib = require('node:zlib')
const mongoose = require('mongoose')

const Activity = require('../models/Activity')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const Config = require('../models/Config')
const Customer = require('../models/Customer')
const CustomerOption = require('../models/CustomerOption')
const CustomerTierHistory = require('../models/CustomerTierHistory')
const Drawer = require('../models/Drawer')
const GroupPayment = require('../models/GroupPayment')
const Loan = require('../models/Loan')
const LoanPayment = require('../models/LoanPayment')
const Notification = require('../models/Notification')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const PaymentInstallment = require('../models/PaymentInstallment')
const Product = require('../models/Product')
const ProductColor = require('../models/ProductColor')
const ProductDetail = require('../models/ProductDetail')
const ProductOption = require('../models/ProductOption')
const ProductPriceHistory = require('../models/ProductPriceHistory')
const ProductProperty = require('../models/ProductProperty')
const ProductStock = require('../models/ProductStock')
const Picture = require('../models/Picture')
const Profile = require('../models/Profile')
const Promotion = require('../models/Promotion')
const Queue = require('../models/Queue')
const Quotation = require('../models/Quotation')
const Reservation = require('../models/Reservation')
const Role = require('../models/Role')
const StockConversion = require('../models/StockConversion')
const Store = require('../models/Store')
const StoreFloor = require('../models/StoreFloor')
const StoreSetting = require('../models/StoreSetting')
const StoreStructure = require('../models/StoreStructure')
const Transaction = require('../models/Transaction')
const TransactionClearance = require('../models/TransactionClearance')
const User = require('../models/User')

// What a selective reset can clear. Settings, the store, its layout, users,
// roles, tiers, cash presets, transfer methods and announcements always stay.
// `requires` lists groups that must go too, since their records point at this one.
const RESET_GROUPS = {
    sales: {
        label: 'Payments & transactions',
        detail: 'Every sale: payments, transactions (cart items), plus what is tied to them: Pay Later, loans, quotations, reservations, orders, queues, drawers and tier history',
        requires: [],
        models: [Payment, Transaction, GroupPayment, PaymentInstallment, Loan, LoanPayment, TransactionClearance, Quotation, Reservation, Order, Queue, Drawer, CustomerTierHistory],
    },
    customers: {
        label: 'Customers',
        detail: 'Every customer and their tier history',
        requires: ['sales'],
        models: [Customer, CustomerTierHistory],
    },
    stock: {
        label: 'Stock',
        detail: 'Stock batches, conversions and stock alerts',
        requires: ['sales'],
        models: [ProductStock, StockConversion, Notification],
    },
    catalog: {
        label: 'Products',
        detail: 'Products with their colors, options and price history, plus brands, categories and promotions',
        requires: ['stock', 'sales'],
        models: [Product, ProductColor, ProductDetail, ProductOption, ProductProperty, CustomerOption, ProductPriceHistory, Promotion, Brand, Category],
    },
    activity: {
        label: 'Activity log',
        detail: 'The record of who did what, and notifications',
        requires: [],
        models: [Activity, Notification],
    },
}

// The chosen groups plus everything they depend on
const resolveGroups = (groups = []) => {
    const result = new Set()
    const add = (key) => {
        if (!RESET_GROUPS[key] || result.has(key)) return
        result.add(key)
        RESET_GROUPS[key].requires.forEach(add)
    }
    groups.forEach(add)
    return Object.keys(RESET_GROUPS).filter((key) => result.has(key))
}

// Runs mongodump into a new timestamped folder. Resolves with the folder's name;
// rejects if the dump fails, so callers never reset without a backup.
const backupDatabase = (label = 'backup') => new Promise((resolve, reject) => {
    const backupRoot = process.env.MONGO_BACKUP_PATH
    const mongoDumpPath = process.env.MONGO_DUMP_PATH
    if (!backupRoot || !mongoDumpPath) return reject(new Error('Backup is not set up (MONGO_BACKUP_PATH / MONGO_DUMP_PATH)'))
    try {
        fs.mkdirSync(backupRoot, { recursive: true })
    } catch (err) {
        return reject(new Error(`Cannot create the backup folder: ${err.message}`))
    }
    const name = `${new Date().toISOString().replace(/:/g, '-')}-${label}`
    const backupPath = path.join(backupRoot, name)
    // Arguments are passed directly (no shell), so the URI is never parsed by one
    execFile(mongoDumpPath, [`--uri=${process.env.DATABASE_URL}`, `--out=${backupPath}`], (error) => {
        if (error) return reject(new Error('Mongo dump failed'))
        resolve({ name, path: backupPath })
    })
})

// Puts back the stock that live sales (cart items and sold items) took.
// Removed cart items and rejected loans already gave theirs back.
const restoreSoldStock = async () => {
    const totals = {}
    const cursor = Transaction.find({ isDeleted: { $ne: true }, state: { $ne: 'REJECTED' } }).select('stocks').lean().cursor()
    for await (const transaction of cursor) {
        (transaction.stocks || []).forEach((item) => {
            if (!item?.id || !item.quantity) return
            const id = item.id.toString()
            totals[id] = (totals[id] || 0) + item.quantity
        })
    }
    const ops = Object.entries(totals).map(([id, quantity]) => ({
        updateOne: { filter: { _id: id }, update: { $inc: { quantity } } },
    }))
    if (ops.length) await ProductStock.bulkWrite(ops)
    return ops.length
}

// Clears the chosen groups (and what depends on them), fixing up what stays
const resetGroups = async (groups) => {
    const keys = resolveGroups(groups)
    const has = (key) => keys.includes(key)
    const cleared = {}

    if (has('sales')) {
        // Stock that stays gets back what was sold from it
        if (!has('stock')) {
            await restoreSoldStock()
            await ProductStock.updateMany({}, { $set: { transactions: [] } })
        }
        // Customers that stay start again with no spend, points or earned tier
        if (!has('customers')) {
            await Customer.updateMany({}, { $set: { point: 0, tierSpent: 0 }, $unset: { tierCheckedAt: 1, tierUpdatedAt: 1 } })
            await Customer.updateMany({ tierLocked: { $ne: true } }, { $unset: { tier: 1 } })
        }
        await StoreStructure.updateMany({}, { $set: { status: 'vacant', reservations: [] } })
        await User.updateMany({}, { $unset: { drawer: 1 } })
        await StoreSetting.updateMany({}, { $unset: { customerTierCheckedAt: 1 } })
    }
    if (has('stock') && !has('catalog')) {
        await Product.updateMany({}, { $set: { stocks: [] }, $unset: { lastConversion: 1 } })
    }
    if (has('catalog')) {
        await User.updateMany({}, { $set: { favorites: [] } })
    }

    // Delete the records themselves; a model shared by two groups is cleared once
    const seen = new Set()
    for (const key of keys) {
        for (const Model of RESET_GROUPS[key].models) {
            if (seen.has(Model.collection.name)) continue
            seen.add(Model.collection.name)
            const { deletedCount } = await Model.deleteMany({})
            cleared[Model.collection.name] = deletedCount
        }
    }
    return { groups: keys, cleared }
}

// Back to a fresh install. Super Admin roles and the users holding them stay
// (with their own profile and theme settings) so nobody is locked out.
const hardReset = async () => {
    const adminRoles = await Role.find({ isDefault: true }).select('_id').lean()
    const adminRoleIds = adminRoles.map((role) => role._id)
    const keptUsers = await User.find({ $or: [{ isDefault: true }, { role: { $in: adminRoleIds } }] }).select('_id profile config').lean()
    const profileIds = keptUsers.map((user) => user.profile).filter(Boolean)
    const profiles = await Profile.find({ _id: { $in: profileIds } }).select('photo').lean()
    const keep = {
        [Role.collection.name]: { _id: { $in: adminRoleIds } },
        [User.collection.name]: { _id: { $in: keptUsers.map((user) => user._id) } },
        [Profile.collection.name]: { _id: { $in: profileIds } },
        [Config.collection.name]: { _id: { $in: keptUsers.map((user) => user.config).filter(Boolean) } },
        // Their profile photos
        [Picture.collection.name]: { _id: { $in: profiles.map((profile) => profile.photo).filter(Boolean) } },
    }

    const cleared = {}
    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()
    for (const { name } of collections) {
        if (name.startsWith('system.')) continue
        const filter = keep[name] ? { $nor: [keep[name]] } : {}
        const { deletedCount } = await mongoose.connection.db.collection(name).deleteMany(filter)
        cleared[name] = deletedCount
    }

    await User.updateMany({}, { $set: { favorites: [] }, $unset: { drawer: 1 } })
    // The same starting records a first start creates (configs/db.js)
    await Store.create({})
    await StoreFloor.create({})
    await StoreSetting.create({})
    return { keptUsers: keptUsers.length, cleared }
}

// ---- Restore ----

// mongorestore ships next to mongodump in the MongoDB Database Tools
const restoreTool = () => process.env.MONGO_RESTORE_PATH || path.join(path.dirname(process.env.MONGO_DUMP_PATH || ''), 'mongorestore')

// The tool's own failure line, without any connection string in it
const toolError = (stderr = '') => {
    const lines = String(stderr).split(/\r?\n/).filter(Boolean)
    const failed = lines.reverse().find((line) => /Failed:|error/i.test(line)) || lines[0] || 'mongorestore failed'
    return failed.replace(/^\S+\s+/, '').replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')
}

// Resolves with the tool's log (it writes everything to stderr)
const runRestore = (args) => new Promise((resolve, reject) => {
    execFile(restoreTool(), [`--uri=${process.env.DATABASE_URL}`, ...args], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(error.code === 'ENOENT' ? 'mongorestore was not found next to mongodump' : toolError(stderr)))
        resolve(String(stderr))
    })
})

// A mongodump folder holds one folder per database. Returns the one with data,
// or null for the backup of an empty database (mongodump writes nothing then).
const dbFolderOf = (folder) => {
    if (!fs.existsSync(folder)) return null
    const dbs = fs.readdirSync(folder, { withFileTypes: true }).filter((item) => item.isDirectory())
        .map((item) => path.join(folder, item.name))
        .filter((dir) => fs.readdirSync(dir).some((file) => file.endsWith('.bson') || file.endsWith('.metadata.json')))
    if (dbs.length > 1) throw new Error('The backup folder must hold exactly one database')
    return dbs[0] || null
}

// Every collection of the backup goes into this app's database, whatever the
// database was called where the backup was made. Two mongorestore traps, each of
// which "succeeds" while restoring nothing when the URI names a database:
// - archives are filtered to that database's name before renaming, so
//   --nsInclude=* is needed for a backup made under another name;
// - a folder must point at the database's own folder, with the target named.
// Returns null when there is nothing to restore (an empty database's backup).
const sourceArgs = (source) => {
    const current = mongoose.connection.db.databaseName
    if (source.kind === 'archive') return [`--archive=${source.path}`, '--gzip', '--nsInclude=*', '--nsFrom=$db$.$coll$', `--nsTo=${current}.$coll$`]
    const dbFolder = dbFolderOf(source.path)
    return dbFolder ? [`--db=${current}`, `--dir=${dbFolder}`] : null
}

// The collections a dry run says it will restore, e.g. "found collection `a.x`
// bson to restore to `b.x`" gives "x"
const plannedCollections = (log) => {
    const names = new Set()
    for (const match of log.matchAll(/found collection `[^`]*` bson to restore to `[^.`]+\.([^`]+)`/g)) names.add(match[1])
    return [...names].filter((name) => !name.startsWith('system.'))
}

// Guards against a restore that silently restored nothing
const checkRestored = async (planned) => {
    const present = new Set((await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name))
    const missing = planned.filter((name) => !present.has(name))
    if (missing.length) throw new Error(`collections missing after restore: ${missing.slice(0, 5).join(', ')}`)
}

// A truncated download still passes a dry run, so the whole file is unzipped first
const checkGzip = (file) => new Promise((resolve, reject) => {
    const fail = () => reject(new Error('The file is damaged or is not a complete backup'))
    fs.createReadStream(file).on('error', fail)
        .pipe(zlib.createGunzip()).on('error', fail)
        .on('data', () => {}).on('end', resolve)
})

const dirSize = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const full = path.join(dir, entry.name)
    return total + (entry.isDirectory() ? dirSize(full) : fs.statSync(full).size)
}, 0)

// Backups in the server's backup folder: folders written by "before reset"
// backups, and any .archive.gz files placed there
const listBackups = () => {
    const root = process.env.MONGO_BACKUP_PATH
    if (!root || !fs.existsSync(root)) return []
    return fs.readdirSync(root, { withFileTypes: true })
        .map((entry) => {
            const full = path.join(root, entry.name)
            if (entry.isDirectory()) {
                let dbFolder = null
                try { dbFolder = dbFolderOf(full) } catch (err) { return null }
                if (!dbFolder) return null
                return { name: entry.name, kind: 'folder', path: full, size: dirSize(full), createdAt: fs.statSync(full).mtime }
            }
            if (entry.name.endsWith('.archive.gz')) {
                const stat = fs.statSync(full)
                return { name: entry.name, kind: 'archive', path: full, size: stat.size, createdAt: stat.mtime }
            }
            return null
        })
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt)
}

const dropAllCollections = async () => {
    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()
    for (const { name } of collections) {
        if (!name.startsWith('system.')) await mongoose.connection.db.dropCollection(name)
    }
}

// Empties the database, then loads the source into it (nothing to load for an
// empty database's backup) and checks every planned collection arrived
const replaceWith = async (source, planned, extra = []) => {
    await dropAllCollections()
    const args = sourceArgs(source)
    if (!args) return
    await runRestore([...args, '--drop', ...extra])
    await checkRestored(planned)
}

// Replaces the whole database with a backup. The backup is checked first and a
// safety backup is taken; if restoring fails part way, the safety backup is put
// back so the database is never left half restored.
// source: { kind: 'archive' | 'folder', path }
const restoreDatabase = async (source) => {
    if (source.kind === 'archive') await checkGzip(source.path)
    let planned
    try {
        const args = sourceArgs(source)
        if (!args) throw new Error('the backup is empty')
        planned = plannedCollections(await runRestore([...args, '--dryRun', '-v']))
    } catch (err) {
        throw new Error(`This is not a backup the app can restore (${err.message})`)
    }

    const safety = await backupDatabase('before-restore')
    const safetySource = { kind: 'folder', path: safety.path }
    try {
        await replaceWith(source, planned, ['--stopOnError'])
    } catch (err) {
        let rolledBack = false
        try {
            const safetyArgs = sourceArgs(safetySource)
            const safetyPlanned = safetyArgs ? plannedCollections(await runRestore([...safetyArgs, '--dryRun', '-v'])) : []
            await replaceWith(safetySource, safetyPlanned)
            rolledBack = true
        } catch (rollbackErr) {
            console.error(`Rollback after a failed restore also failed: ${rollbackErr.message}`)
        }
        const error = new Error(rolledBack
            ? `Restore failed (${err.message}), so the data was put back as it was`
            : `Restore failed (${err.message}) and the data could not be put back. Restore the backup ${safety.name} from the server's backup folder`)
        error.safety = safety.name
        throw error
    }
    return { safety: safety.name }
}

module.exports = { RESET_GROUPS, resolveGroups, backupDatabase, resetGroups, hardReset, listBackups, restoreDatabase }
