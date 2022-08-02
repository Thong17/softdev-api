const Store = require('../models/Store')
const { default: mongoose } = require('mongoose')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createStoreValidation } = require('../middleware/validations/storeValidation')
const StoreFloor = require('../models/StoreFloor')
const StoreStructure = require('../models/StoreStructure')

exports.index = async (req, res) => {
    try {
        const store = await Store.findOne().populate('logo')
        return response.success(200, { data: store }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    Store.findById(req.params.id, (err, store) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: store }, res)
    }).populate('logo')
}

exports.floors = async (req, res) => {
    StoreFloor.find({ isDisabled: false }, (err, floors) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: floors }, res)
    }).select('floor tags')
}

exports.structures = async (req, res) => {
    StoreStructure.find({ isDisabled: false }, (err, structures) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: structures }, res)
    })
}

exports.layout = async (req, res) => {
    const id = req.query.id

    StoreFloor.findById(id, (err, layout) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: layout }, res)
    }).populate('structures')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createStoreValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Store.create(body, (err, store) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Store already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!store) return response.failure(422, { msg: 'No store created!' }, res, err)
            response.success(200, { msg: 'Store has created successfully', data: store }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createStoreValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Store.findByIdAndUpdate(req.params.id, body, (err, store) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!store) return response.failure(422, { msg: 'No store updated!' }, res, err)
            response.success(200, { msg: 'Store has updated successfully', data: store }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateLayout = async (req, res) => {
    const floorId = req.params.id
    const { structures, mergedStructures, column, row } = req.body
    try {
        const layout = await StoreFloor.findById(floorId)
        await StoreStructure.deleteMany({ floor: floorId })

        const filteredStructures = structures.filter(structure => structure.type !== 'blank')
        const insertedStructures = await StoreStructure.insertMany(filteredStructures)

        layout.structures = insertedStructures
        layout.mergedStructures = mergedStructures
        layout.column = column
        layout.row = row
        layout.save()

        return response.success(200, { msg: 'Layout has updated successfully' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Store.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, store) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!store) return response.failure(422, { msg: 'No store deleted!' }, res, err)
            response.success(200, { msg: 'Store has deleted successfully', data: store }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const stores = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: stores }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const stores = req.body

        stores.forEach(store => {
            store.name = JSON.parse(store.name)
            store.icon = JSON.parse(store.icon)
        })

        Store.insertMany(stores)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'branches' : 'branch'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

