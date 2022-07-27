const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const Role = require('../models/Role')
const User = require('../models/User')

exports.admin = async (req, res) => {
    try {
        const totalRole = await Role.count({ isDisabled: false })
        const totalUser = await User.count({ isDisabled: false })
        const roles = await Role.find({ isDisabled: false }).select('name privilege')
        let totalPrivilege
        const roleData = []
        roles.forEach((role) => {
            let privilege = 0
            totalPrivilege = 0
            Object.keys(role.privilege)?.forEach((route) => {
                Object.keys(role.privilege?.[route])?.forEach((action) => {
                    if (role.privilege?.[route]?.[action]) privilege += 1
                    totalPrivilege += 1
                })
            })
            let obj = {
                id: role._id,
                name: role.name,
                value: privilege,
                title: 'Assigned',
                detail: totalPrivilege
            }
            roleData.push(obj)
        })

        const users = await User.find({ isDisabled: false }).select('role')
        const userData = []
        roleData.forEach((role) => {
            let userObj = {
                name: role.name,
                value: 0,
                title: 'User',
                detail: role.value
            }
            users.forEach((user) => {
                if (user.role.equals(role.id)) userObj.value += 1
            })
            userData.push(userObj)
        })

        return response.success(200, { data: { totalRole, totalUser, totalPrivilege, roles: roleData, users: userData } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}