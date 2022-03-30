const { encryptPassword, comparePassword, extractJoiErrors, issueToken, createHash } = require('../helpers/utils')
const Users = require('../models/Users')
const response = require('../helpers/response')
const { loginValidation, registerValidation } = require('../middleware/validations/authValidation')


exports.login = async (req, res) => {
    const body = req.body
    const { error } = loginValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        // Sign In 
        Users.findOne({ email: body.email }, (err, User) => {
            if (err) return response.failure(422, { msg: 'Trouble while collecting data!' }, res, err)
            if (!User) return response.failure(404, { msg: 'Email or Password is incorrect!' }, res)

            comparePassword(body.password, User.password)
                .then(isMatch => {
                    if (!isMatch) return response.failure(404, { msg: 'Email or Password is incorrect!' }, res)
                    issueToken({ id: User.id, username: User.username }, process.env.TOKEN_SECRET, 60)
                        .then(token => {
                            return response.success(200, { accessToken: token }, res)
                        })
                        .catch(err => {
                            return response.failure(422, { msg: 'Problem while generating token!' }, res, err)
                        })
                })
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
        // Sign Up
        delete body.confirm_password
        body.password = await encryptPassword(body.password)

        Users.create(body, (err, User) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Email already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: 'Trouble while collecting data!' }, res, err)
                }
                
            }

            if (User) return response.success(422, { msg: 'User has created successfully', user: User }, res)
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
