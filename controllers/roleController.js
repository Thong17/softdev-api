const Role = require('../models/Role')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors } = require('../helpers/utils')
const { createRoleValidation } = require('../middleware/validations/roleValidation')

exports.index = async (req, res) => {
    Role.find({}, (err, roles) => {
        if (err) return response.failure(422, { msg: 'Trouble while collecting data!' }, res, err)
        return response.success(200, { data: roles }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createRoleValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Role.create(body, (err, role) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Role already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!role) return response.failure(422, { msg: 'No role created!' }, res, err)
            response.success(200, { msg: 'Role has created successfully', role: role }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

