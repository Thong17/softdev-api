/**
 * One-off utility: makes sure a user has full (all-true) permission in
 * every store they belong to - or, if they don't belong to any store yet
 * (e.g. a bootstrap account orphaned by a migration that expected a legacy
 * `role` field that was never set), attaches them to one.
 *
 * Rather than mutating whatever role is currently assigned to the user
 * (that role may be shared with other StoreMembers - e.g. a "Cashier" role
 * - and blanket-setting it to full would silently elevate everyone else who
 * has it), this finds or creates a dedicated "Super Admin" role per store
 * (same shape the bootstrap admin and store creator already get) and
 * reassigns only this user's membership to it.
 *
 * Safe to re-run: it just refreshes the "Super Admin" role's privilege back
 * to full and re-points the membership at it.
 *
 * Usage: node scripts/grantFullPermission.js <username> [storeId]
 *   - username defaults to "Admin" (the seeded bootstrap account)
 *   - storeId is optional; if omitted and the user already has membership(s),
 *     every store they belong to is updated. If they have no membership at
 *     all, the first existing store is used (one is created if the database
 *     has none).
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Store = require('../models/Store')
const StoreMember = require('../models/StoreMember')
const Role = require('../models/Role')
const { preRole } = require('../constants/roleMap')

const FULL_PRIVILEGE = (() => {
    const privilege = {}
    Object.keys(preRole).forEach(menu => {
        privilege[menu] = {}
        Object.keys(preRole[menu]).forEach(route => {
            privilege[menu][route] = true
        })
    })
    return privilege
})()

async function ensureSuperAdminRole(storeId, user) {
    let role = await Role.findOne({ store: storeId, name: { English: 'Super Admin' } })
    if (!role) {
        role = await Role.create({
            name: { English: 'Super Admin' },
            store: storeId,
            privilege: FULL_PRIVILEGE,
            description: 'Full-permission role granted via scripts/grantFullPermission.js',
            isDefault: true,
            createdBy: user._id,
        })
        console.log(`Created "Super Admin" role for store ${storeId}`)
    } else {
        role.privilege = FULL_PRIVILEGE
        await role.save()
        console.log(`Refreshed "Super Admin" role privileges for store ${storeId}`)
    }
    return role
}

async function run() {
    const username = process.argv[2] || 'Admin'
    const explicitStoreId = process.argv[3]

    await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true })
    console.log('Connected to Mongo...')

    const user = await User.findOne({ username })
    if (!user) {
        console.error(`No user found with username "${username}"`)
        process.exit(1)
    }

    const memberQuery = { user: user.id }
    if (explicitStoreId) memberQuery.store = explicitStoreId
    const memberships = await StoreMember.find(memberQuery)

    if (memberships.length > 0) {
        for (const member of memberships) {
            const role = await ensureSuperAdminRole(member.store, user)
            member.role = role._id
            member.isDisabled = false
            await member.save()
            console.log(`Assigned "${username}" the full-permission role in store ${member.store}`)
        }
        console.log('Done.')
        await mongoose.disconnect()
        return
    }

    // No membership at all - attach them instead of giving up.
    console.warn(`User "${username}" has no membership${explicitStoreId ? ` for store ${explicitStoreId}` : ''} - creating one.`)

    let store
    if (explicitStoreId) {
        store = await Store.findById(explicitStoreId)
        if (!store) {
            console.error(`No store found with id "${explicitStoreId}"`)
            process.exit(1)
        }
    } else {
        store = await Store.findOne({ isDeleted: false })
        if (!store) {
            store = await Store.create({ name: 'Store 1', createdBy: user._id })
            console.log(`No existing store found - created "${store.name}" (${store.id})`)
        }
    }

    const role = await ensureSuperAdminRole(store.id, user)
    await StoreMember.create({
        store: store.id,
        user: user.id,
        role: role._id,
        isDefault: true,
        createdBy: user._id,
    })
    console.log(`Attached "${username}" to store "${store.name || store.id}" with full permission`)

    console.log('Done.')
    await mongoose.disconnect()
}

run().catch(err => {
    console.error('Failed:', err)
    process.exit(1)
})
