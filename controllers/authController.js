const { extractJoiErrors } = require('../helpers/utils')
const User = require('../models/User')
const StoreMember = require('../models/StoreMember')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { loginValidation, registerValidation } = require('../middleware/validations/authValidation')


exports.login = async (req, res) => {
    const body = req.body
    const { error } = loginValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        User.authenticate(body.username, body.password, async (err, data) => {
            if (err) return response.failure(err.code, { msg: err.msg }, res, err)

            const memberships = await StoreMember.find({ user: data.user?.id, isDisabled: false }).populate('store').populate('role')
            const stores = memberships.map(member => ({
                id: member.store?.id,
                name: member.store?.name,
                logo: member.store?.logo,
                roleName: member.role?.name,
                isDefault: member.isDefault
            }))
            const activeMember = memberships.find(member => member.isDefault) || (memberships.length === 1 ? memberships[0] : null)

            const user = {
                id: data.user?.id,
                username: data.user?.username,
                privilege: activeMember?.role?.privilege,
                photo: data.user?.profile?.photo?.filename,
                theme: data.user?.config?.theme,
                language: data.user?.config?.language,
                favorites: data.user?.favorites,
                drawer: data.user?.drawer,
                isDefault: data.user?.isDefault,
                mustChangePassword: data.user?.mustChangePassword,
                stores,
                activeStoreId: activeMember?.store?.id || null
            }
            response.success(200, { accessToken: data.token, user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.register = async (req, res) => {
    const body = req.body
    const { error } = registerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        delete body.confirm_password
        const password = await encryptPassword(body.password)
        User.create({...body, password}, (err, user) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Username already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!user) return response.failure(422, { msg: 'No user created!' }, res, err)
            response.success(200, { msg: 'User has created successfully', user: user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

