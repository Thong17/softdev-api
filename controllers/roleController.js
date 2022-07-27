const Role = require('../models/Role')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createRoleValidation } = require('../middleware/validations/roleValidation')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }

    Role.find({ isDisabled: false, ...query }, async (err, roles) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Role.count({ isDisabled: false })
        return response.success(200, { data: roles, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('createdBy')
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
    }).select('name privilege')
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
        const role = await Role.findById(req.params.id)
        if (role?.isDefault) return response.failure(422, { msg: 'Default role cannot be delete' }, res)

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

