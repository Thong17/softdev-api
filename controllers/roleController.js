const Role = require('../models/Role')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createRoleValidation } = require('../middleware/validations/roleValidation')

exports.index = async (req, res) => {
    Role.find({ isDisabled: false }, (err, roles) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: roles }, res)
    }).populate('createdBy')
}

exports.detail = async (req, res) => {
    Role.findById(req.params.id, (err, role) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: role }, res)
    })
}

exports.list = async (req, res) => {
    Role.find({ isDisabled: false }, (err, roles) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: roles }, res)
    })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createRoleValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Role.create({...body, createdBy: req.user.id}, (err, role) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Role already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!role) return response.failure(422, { msg: 'No role created!' }, res, err)
            response.success(200, { msg: 'Role has created successfully', data: role }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createRoleValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Role.findByIdAndUpdate(req.params.id, body, (err, role) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!role) return response.failure(422, { msg: 'No role updated!' }, res, err)
            response.success(200, { msg: 'Role has updated successfully', data: role }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Role.findByIdAndUpdate(req.params.id, { isDisabled: true }, (err, role) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!role) return response.failure(422, { msg: 'No role deleted!' }, res, err)
            response.success(200, { msg: 'Role has deleted successfully', data: role }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.getPrivilege = (req, res) => {
    const { privilege } = require('../constants/roleMap')
    response.success(200, { data: privilege }, res)
}

exports.getPreRole = (req, res) => {
    const { preRole } = require('../constants/roleMap')
    response.success(200, { data: preRole }, res)
}

exports._import = async (req, res) => {
    try {
        const roles = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: roles }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const roles = req.body

        roles.forEach(role => {
            role.privilege = JSON.parse(role.privilege)
            role.name = JSON.parse(role.name)
        })

        Role.insertMany(roles)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'roles' : 'role'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

