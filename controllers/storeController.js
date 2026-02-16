const Store = require('../models/Store')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, sendMessageTelegram } = require('../helpers/utils')
const { createStoreValidation, createFloorValidation, transferValidation, updateTelegramSettingValidation } = require('../middleware/validations/storeValidation')
const StoreFloor = require('../models/StoreFloor')
const Transfer = require('../models/Transfer')
const StoreStructure = require('../models/StoreStructure')
const StoreSetting = require('../models/StoreSetting')

exports.index = async (req, res) => {
    try {
        const store = await Store.findOne().populate('logo')
        const floorCount = await StoreFloor.count({ isDisabled: false })
        const tableCount = await StoreStructure.count({ isDisabled: false, type: 'table' })
        const roomCount = await StoreStructure.count({ isDisabled: false, type: 'room' })
        return response.success(200, { data: store, floorCount, tableCount, roomCount }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    Store.findOne({}, (err, store) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: store }, res)
    }).populate('logo')
}

exports.floors = async (req, res) => {
    StoreFloor.find({ isDisabled: false }, (err, floors) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: floors }, res)
    }).select('floor description order tags')
}

exports.structures = async (req, res) => {
    StoreStructure.find({ isDisabled: false }, (err, structures) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const data = structures.filter(item => !(item.merged && !item.isMain))
        return response.success(200, { data }, res)
    }).populate('floor', 'floor')
}

exports.listStructure = async (req, res) => {
    StoreStructure.find({ isDisabled: false }, (err, structures) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const data = structures.filter(item => !(item.merged && !item.isMain))
        return response.success(200, { data }, res)
    }).select('title status type size price merged isMain').populate('floor', 'floor')
}

exports.listTransfer = async (req, res) => {
    Transfer.find({}, (err, transfers) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: transfers }, res)
    }).populate('image', 'filename')
}

exports.layout = async (req, res) => {
    const id = req.query.id

    StoreFloor.findById(id, (err, layout) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: layout }, res)
    }).populate({ path: 'structures', populate: [{ path: 'floor', select: 'floor' }, { path: 'reservations', populate: { path: 'customer', populate: { path: 'picture' } }, match: { isCompleted: false } }] })
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

exports.createTransfer = async (req, res) => {
    const body = req.body
    const { error } = transferValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Transfer.create(body, (err, transfer) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Transfer already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!transfer) return response.failure(422, { msg: 'No transfer created!' }, res, err)
            response.success(200, { msg: 'Transfer has created successfully', data: transfer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.createFloor = async (req, res) => {
    const body = req.body
    const { error } = createFloorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        StoreFloor.create(body, (err, floor) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Floor already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!floor) return response.failure(422, { msg: 'No floor created!' }, res, err)
            response.success(200, { msg: 'Floor has created successfully', data: floor }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateFloor = async (req, res) => {
    const body = req.body
    const { error } = createFloorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        StoreFloor.findByIdAndUpdate(req.params.id, body, (err, floor) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!floor) return response.failure(422, { msg: 'No floor updated!' }, res, err)
            response.success(200, { msg: 'Floor has updated successfully', data: floor }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateTransfer = async (req, res) => {
    const body = req.body
    const { error } = transferValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Transfer.findByIdAndUpdate(req.params.id, body, (err, transfer) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            if (!transfer) return response.failure(422, { msg: 'No transfer updated!' }, res, err)
            response.success(200, { msg: 'Transfer has updated successfully', data: transfer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.deleteTransfer = async (req, res) => {
    try {
        Transfer.findByIdAndRemove(req.params.id, (err, transfer) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            if (!transfer) return response.failure(422, { msg: 'No transfer deleted!' }, res, err)
            response.success(200, { msg: 'Transfer has deleted successfully', data: transfer._id }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableFloor = async (req, res) => {
    try {
        StoreFloor.findByIdAndUpdate(req.params.id, { isDisabled: true }, (err, floor) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!floor) return response.failure(422, { msg: 'No floor deleted!' }, res, err)
            response.success(200, { msg: 'Floor has deleted successfully', data: floor._id }, res)
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

        const filteredStructures = structures.filter(structure => {
            if (structure.type === 'blank' && !structure.merged) return false
            return true
        })
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

exports.getTelegramSetting = async (req, res) => {
    try {
        const setting = await StoreSetting.findOne()
        if (!setting) return response.success(200, { data: await StoreSetting.create({}) }, res)

        return response.success(200, { data: { telegramAPIKey: setting.telegramAPIKey, telegramChatID: setting.telegramChatID, telegramPrivilege: setting.telegramPrivilege } }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateTelegramSetting = async (req, res) => {
    const body = req.body
    const { error } = updateTelegramSettingValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        sendMessageTelegram({ text: 'Bot has been connected', token: body.telegramAPIKey, chatId: body.telegramChatID })
            .then(() => {
                StoreSetting.findOneAndUpdate({}, body, { upsert: true, new: true, setDefaultsOnInsert: true }, (err, setting) => {
                    if (err) return response.failure(422, { msg: err.message }, res, err)
        
                    if (!setting) return response.failure(422, { msg: 'No setting update!' }, res, err)
                    response.success(200, { msg: 'Setting has updated successfully', data: setting }, res)
                })
            })
            .catch((err) => {
                return response.failure(err?.response?.data?.error_code || 422, { msg: 'Cannot connect to telegram bot' }, res, err)
            })
        
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

