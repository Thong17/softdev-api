const Role = require('../models/Role')

// Privileges added after the first deploy are missing from roles created back
// then. The Super Admin role gets all of them. Customer routes used to be
// guarded by the brand privileges, so other roles start with the same customer
// rights they effectively had.
const syncRolePrivileges = async () => {
    try {
        const { preRole } = require('../constants/roleMap')
        const roles = await Role.find({})
        for (const role of roles) {
            const privilege = { ...(role.privilege || {}) }
            let changed = false
            if (role.isDefault) {
                Object.keys(preRole).forEach(menu => {
                    privilege[menu] = { ...(privilege[menu] || {}) }
                    Object.keys(preRole[menu]).forEach(action => {
                        if (privilege[menu][action] === undefined) {
                            privilege[menu][action] = true
                            changed = true
                        }
                    })
                })
            } else if (!privilege.customer) {
                const brand = privilege.brand || {}
                privilege.customer = {}
                Object.keys(preRole.customer).forEach(action => {
                    privilege.customer[action] = !!brand[action]
                })
                changed = true
            }
            if (changed) await Role.updateOne({ _id: role._id }, { privilege })
        }
    } catch (err) {
        console.error(err)
    }
}

module.exports = { syncRolePrivileges }
