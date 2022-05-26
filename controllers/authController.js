const { extractJoiErrors } = require('../helpers/utils')
const User = require('../models/User')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { loginValidation, registerValidation } = require('../middleware/validations/authValidation')


exports.login = async (req, res) => {
    const body = req.body
    const { error } = loginValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        User.authenticate(body.username, body.password, (err, data) => {
            if (err) return response.failure(err.code, { msg: err.msg }, res, err)

            const user = {
                id: data.user.id,
                username: data.user.username,
                privilege: data.user.role.privilege,
                photo: data.user.profile?.photo,
                theme: data.user.config?.theme,
                language: data.user.config?.language,
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
        User.create(body, (err, user) => {
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

