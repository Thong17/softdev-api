/**
 * One-off migration: moves an existing single-tenant SoftDev database onto
 * the multi-store schema (see models/StoreMember.js and the `store` field
 * added to Product/Brand/Category/ProductStock/Transaction/Transfer/
 * ProductProperty/ProductOption/ProductColor/CustomerOption/ProductDetail/
 * Notification/etc), and backfills `store` on Payment/GroupPayment/
 * LoanPayment/TransactionClearance (added later) by deriving it from each
 * document's linked Transaction/Payment/Loan rather than assuming
 * everything belongs to Store 1.
 *
 * Safe to re-run: every step is scoped to documents that don't have a
 * `store` set yet, so running it twice is a no-op the second time.
 *
 * Usage: node scripts/migrateMultiStore.js
 */
require('dotenv').config()
const mongoose = require('mongoose')

const Store = require('../models/Store')
const Role = require('../models/Role')
const StoreMember = require('../models/StoreMember')
const Product = require('../models/Product')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const ProductStock = require('../models/ProductStock')
const Transaction = require('../models/Transaction')
const Drawer = require('../models/Drawer')
const Customer = require('../models/Customer')
const Promotion = require('../models/Promotion')
const Loan = require('../models/Loan')
const Reservation = require('../models/Reservation')
const Queue = require('../models/Queue')
const StoreFloor = require('../models/StoreFloor')
const StoreStructure = require('../models/StoreStructure')
const StoreSetting = require('../models/StoreSetting')
const Activity = require('../models/Activity')
const PresetCash = require('../models/PresetCash')
const Payment = require('../models/Payment')
const GroupPayment = require('../models/GroupPayment')
const LoanPayment = require('../models/LoanPayment')
const TransactionClearance = require('../models/TransactionClearance')
const Transfer = require('../models/Transfer')
const ProductProperty = require('../models/ProductProperty')
const ProductOption = require('../models/ProductOption')
const ProductColor = require('../models/ProductColor')
const CustomerOption = require('../models/CustomerOption')
const ProductDetail = require('../models/ProductDetail')
const Notification = require('../models/Notification')

const STORE_SCOPED_MODELS = [
    Product, Brand, Category, ProductStock, Transaction, Drawer, Customer,
    Promotion, Loan, Reservation, Queue, StoreFloor, StoreStructure,
    StoreSetting, Activity, PresetCash, Role, Transfer,
    ProductProperty, ProductOption, ProductColor, CustomerOption, ProductDetail,
    Notification,
]

async function migrate() {
    await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true })
    console.log('Connected to Mongo, starting migration...')

    // 1. Resolve (or create) "Store 1" - the store every pre-existing
    // document/user gets attached to.
    let store = await Store.findOne({})
    if (!store) {
        store = await Store.create({ name: 'Store 1' })
        console.log(`No existing Store found - created "${store.name}" (${store.id})`)
    } else {
        console.log(`Using existing store "${store.name}" (${store.id}) as Store 1`)
    }

    // 2. Attach `store` to every pre-existing document across the
    // now-store-scoped collections (idempotent: only touches docs missing it).
    for (const Model of STORE_SCOPED_MODELS) {
        const result = await Model.updateMany({ store: { $exists: false } }, { $set: { store: store.id } })
        console.log(`${Model.modelName}: set store on ${result.modifiedCount} document(s)`)
    }

    // 3. Every pre-existing user gets a StoreMember for Store 1, carrying
    // over their old single `role` field. That field was removed from the
    // User schema, so it's read directly off the raw collection.
    const rawUsers = await mongoose.connection.db.collection('users').find({}).toArray()
    let createdMembers = 0
    for (const user of rawUsers) {
        if (!user.role) {
            console.warn(`User ${user.username} (${user._id}) has no legacy role - skipping membership creation`)
            continue
        }

        const existing = await StoreMember.findOne({ store: store.id, user: user._id })
        if (existing) continue

        await StoreMember.create({
            store: store.id,
            user: user._id,
            role: user.role,
            isDefault: true,
        })
        createdMembers++
    }
    console.log(`Created ${createdMembers} StoreMember record(s) for ${rawUsers.length} existing user(s)`)

    // 4. Drop the now-unused `role` field left over on user documents.
    const cleared = await mongoose.connection.db.collection('users').updateMany({ role: { $exists: true } }, { $unset: { role: '' } })
    console.log(`Removed legacy 'role' field from ${cleared.modifiedCount} user document(s)`)

    // 5. Payment/GroupPayment/LoanPayment/TransactionClearance were added to
    // the multi-store schema later, after self-serve store creation had
    // already shipped - so unlike the collections above, existing docs here
    // may legitimately belong to a store other than Store 1. Derive `store`
    // from whichever already-scoped document each one is linked to, and only
    // fall back to Store 1 when no link is found.
    let paymentBackfilled = 0
    const payments = await Payment.find({ store: { $exists: false } }).populate('transactions', 'store')
    for (const payment of payments) {
        const derivedStore = payment.transactions?.find(t => t.store)?.store || store.id
        payment.store = derivedStore
        await payment.save()
        paymentBackfilled++
    }
    console.log(`Payment: set store on ${paymentBackfilled} document(s)`)

    let groupPaymentBackfilled = 0
    const groupPayments = await GroupPayment.find({ store: { $exists: false } }).populate('payments', 'store')
    for (const groupPayment of groupPayments) {
        const derivedStore = groupPayment.payments?.find(p => p.store)?.store || store.id
        groupPayment.store = derivedStore
        await groupPayment.save()
        groupPaymentBackfilled++
    }
    console.log(`GroupPayment: set store on ${groupPaymentBackfilled} document(s)`)

    let loanPaymentBackfilled = 0
    const loanPayments = await LoanPayment.find({ store: { $exists: false } }).populate('loan', 'store')
    for (const loanPayment of loanPayments) {
        const derivedStore = loanPayment.loan?.store || store.id
        loanPayment.store = derivedStore
        await loanPayment.save()
        loanPaymentBackfilled++
    }
    console.log(`LoanPayment: set store on ${loanPaymentBackfilled} document(s)`)

    let clearanceBackfilled = 0
    const clearances = await TransactionClearance.find({ store: { $exists: false } }).populate('transaction', 'store').populate('loan', 'store')
    for (const clearance of clearances) {
        const derivedStore = clearance.transaction?.store || clearance.loan?.store || store.id
        clearance.store = derivedStore
        await clearance.save()
        clearanceBackfilled++
    }
    console.log(`TransactionClearance: set store on ${clearanceBackfilled} document(s)`)

    console.log('Migration complete.')
    await mongoose.disconnect()
}

migrate()
    .catch(err => {
        console.error('Migration failed:', err)
        process.exit(1)
    })
