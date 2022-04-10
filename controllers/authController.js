const { extractJoiErrors, createHash } = require('../helpers/utils')
const Users = require('../models/Users')
const response = require('../helpers/response')
const { loginValidation, registerValidation } = require('../middleware/validations/authValidation')


exports.login = async (req, res) => {
    const body = req.body
    const { error } = loginValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Users.authenticate(body.email, body.password, (err, token) => {
            if (err) return response.failure(err.code, { msg: err.msg }, res, err)
            response.success(200, { accessToken: token }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: 'Trouble while collecting data!' }, res, err)
    }
}

exports.signup = async (req, res) => {
    const body = req.body
    const { error } = registerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        delete body.confirm_password
        Users.create(body, (err, user) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Email already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!user) return response.failure(422, { msg: 'No user created!' }, res, err)
            response.success(200, { msg: 'User has created successfully', user: user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: 'Trouble while collecting data!' }, res, err)
    }
}

exports.createHash = (req, res) => {
    const token = req.body.token || ''
    const timestamp = req.body.ts
    const body = req.body.data

    if (!body && !timestamp) return response.failure(400, { msg: 'Missing hash requirement!' }, res)

    try {
        const str = JSON.stringify(body) + process.env.HASH_SECRET + timestamp + token

        const hashed_str = createHash(str)
        return response.success(200, { hashed: hashed_str, ts: timestamp }, res)
    } catch (err) {
        return response.failure(400, { msg: 'Something went wrong while creating hash!' }, res, err)
    }
}
