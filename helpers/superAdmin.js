const Role = require('../models/Role')

// The Super Admin role is the default role the system creates on first start
// (configs/db.js). Only users holding it may see, edit or assign it, or see
// and edit the users who hold it.

const isSuperAdmin = (user) => !!user?.role?.isDefault

const getSuperAdminRoleIds = async () => {
    const roles = await Role.find({ isDefault: true }).select('_id')
    return roles.map(role => role._id.toString())
}

// Query filter that hides Super Admin roles from everyone else
const roleVisibilityFilter = (user) => isSuperAdmin(user) ? {} : { isDefault: { $ne: true } }

// Query filter that hides Super Admin users (and the default Admin user) from everyone else
const userVisibilityFilter = async (user) => {
    if (isSuperAdmin(user)) return {}
    return { isDefault: { $ne: true }, role: { $nin: await getSuperAdminRoleIds() } }
}

const isSuperAdminUser = async (target) => {
    if (!target) return false
    if (target.isDefault) return true
    const roleId = target.role?._id || target.role
    return !!roleId && (await getSuperAdminRoleIds()).includes(roleId.toString())
}

const isSuperAdminRoleId = async (roleId) => !!roleId && (await getSuperAdminRoleIds()).includes(roleId.toString())

module.exports = {
    isSuperAdmin,
    roleVisibilityFilter,
    userVisibilityFilter,
    isSuperAdminUser,
    isSuperAdminRoleId,
}
