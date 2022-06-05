const response = require('../helpers/response')
const Config = require('../models/Config')
const User = require('../models/User')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, encryptPassword } = require('../helpers/utils')
const { createUserValidation } = require('../middleware/validations/userValidation')

exports.index = (req, res) => {
    User.find({ isDisabled: false }, (err, users) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: users }, res)
    }).populate('role')
}

exports.detail = (req, res) => {
    User.findById(req.params.id, (err, user) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: user }, res)
    })
}

exports.create = (req, res) => {
    const body = req.body
    const { error } = createUserValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        User.create({...body, createdBy: req.user.id}, (err, user) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'User already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!user) return response.failure(422, { msg: 'No user created!' }, res, err)
            response.success(200, { msg: 'User has created successfully', data: user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = (req, res) => {
    const body = req.body
    const { error } = createUserValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        User.findByIdAndUpdate(req.params.id, body, (err, user) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!user) return response.failure(422, { msg: 'No user updated!' }, res, err)
            response.success(200, { msg: 'User has updated successfully', data: user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = (req, res) => {
    try {
        User.findByIdAndUpdate(req.params.id, { isDisabled: true }, (err, user) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!user) return response.failure(422, { msg: 'No user deleted!' }, res, err)
            response.success(200, { msg: 'User has deleted successfully', data: user }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const users = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: users }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const users = req.body
        const password = await encryptPassword('default')

        users.forEach(user => {
            user.password = password
        })

        User.insertMany(users)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'users' : 'user'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

exports.profile = (req, res) => {
    const user = {
        id: req.user.id,
        username: req.user.username,
        privilege: req.user.role.privilege,
        photo: req.user.profile?.photo,
        theme: req.user.config?.theme,
        language: req.user.config?.language
    }
    return response.success(200, { user }, res)
}

exports.changeTheme = async (req, res) => {
    try {
        const config = await Config.findById(req.user.config)
        config.theme = req.body.theme
        await config.save()
        return response.success(200, { theme: config.theme }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.changeLanguage = async (req, res) => {
    try {
        const config = await Config.findById(req.user.config)
        config.language = req.body.language
        await config.save()
        return response.success(200, { language: config.language }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}