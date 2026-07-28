const Store = require('../models/Store')
const StoreMember = require('../models/StoreMember')
const Role = require('../models/Role')
const { preRole } = require('../constants/roleMap')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, sendMessageTelegram } = require('../helpers/utils')
const { createStoreValidation, createFloorValidation, transferValidation, updateTelegramSettingValidation } = require('../middleware/validations/storeValidation')
const StoreFloor = require('../models/StoreFloor')
const Transfer = require('../models/Transfer')
const StoreStructure = require('../models/StoreStructure')
const StoreSetting = require('../models/StoreSetting')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0

    try {
        const memberships = await StoreMember.find({ user: req.user.id, isDisabled: false })
            .skip(page * limit).limit(limit)
            .populate({ path: 'store', populate: { path: 'logo' } })
            .populate('role', 'name')
        const totalCount = await StoreMember.count({ user: req.user.id, isDisabled: false })

        const data = memberships.filter(member => member.store && !member.store.isDeleted).map(member => ({
            ...member.store.toObject(),
            roleName: member.role?.name,
            isDefaultStore: member.isDefault
        }))
        return response.success(200, { data, length: totalCount }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    try {
        const member = await StoreMember.findOne({ store: req.params.id, user: req.user.id, isDisabled: false })
        if (!member) return response.failure(401, { msg: 'You are not a member of this store!' }, res)

        const store = await Store.findOne({ _id: req.params.id, isDeleted: false }).populate('logo')
        return response.success(200, { data: store }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.floors = async (req, res) => {
    StoreFloor.find({ isDisabled: false, store: req.store }, (err, floors) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: floors }, res)
    }).select('floor description order tags')
}

exports.structures = async (req, res) => {
    StoreStructure.find({ isDisabled: false, store: req.store }, (err, structures) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const data = structures.filter(item => !(item.merged && !item.isMain))
        return response.success(200, { data }, res)
    }).populate('floor', 'floor')
}

exports.listStructure = async (req, res) => {
    StoreStructure.find({ isDisabled: false, store: req.store }, (err, structures) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const data = structures.filter(item => !(item.merged && !item.isMain))
        return response.success(200, { data }, res)
    }).select('title status type size price merged isMain').populate('floor', 'floor')
}

exports.listTransfer = async (req, res) => {
    Transfer.find({ store: req.store }, (err, transfers) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: transfers }, res)
    }).populate('image', 'filename')
}

exports.layout = async (req, res) => {
    const id = req.query.id

    StoreFloor.findOne({ _id: id, store: req.store }, (err, layout) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: layout }, res)
    }).populate({ path: 'structures', populate: [{ path: 'floor', select: 'floor' }, { path: 'reservations', populate: { path: 'customer', populate: { path: 'picture' } }, match: { isCompleted: false } }] })
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createStoreValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const store = await Store.create({ ...body, createdBy: req.user.id })

        let privilege
        Object.keys(preRole).forEach(menu => {
            privilege = { ...privilege, [menu]: {} }
            Object.keys(preRole[menu]).forEach(route => {
                privilege[menu][route] = true
            })
        })
        const ownerRole = await Role.create({
            name: { English: 'Owner' },
            store: store.id,
            privilege,
            description: 'Default role generated when the store was created',
            isDefault: true,
            createdBy: req.user.id
        })

        const existingMemberships = await StoreMember.count({ user: req.user.id, isDisabled: false })
        await StoreMember.create({
            store: store.id,
            user: req.user.id,
            role: ownerRole.id,
            isDefault: existingMemberships === 0,
            createdBy: req.user.id
        })

        response.success(200, { msg: 'Store has created successfully', data: store }, res)
    } catch (err) {
        switch (err.code) {
            case 11000:
                return response.failure(422, { msg: 'Store already exists!' }, res, err)
            default:
                return response.failure(422, { msg: err.message || failureMsg.trouble }, res, err)
        }
    }
}

exports.createTransfer = async (req, res) => {
    const body = req.body
    const { error } = transferValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Transfer.create({ ...body, store: req.store }, (err, transfer) => {
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
        StoreFloor.create({ ...body, store: req.store }, (err, floor) => {
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
        StoreFloor.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, (err, floor) => {
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
        Transfer.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, (err, transfer) => {
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
        Transfer.findOneAndRemove({ _id: req.params.id, store: req.store }, (err, transfer) => {
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
        StoreFloor.findOneAndUpdate({ _id: req.params.id, store: req.store }, { isDisabled: true }, (err, floor) => {
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
        const member = await StoreMember.findOne({ store: req.params.id, user: req.user.id, isDisabled: false })
        if (!member) return response.failure(401, { msg: 'You are not a member of this store!' }, res)

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
        const layout = await StoreFloor.findOne({ _id: floorId, store: req.store })
        if (!layout) return response.failure(422, { msg: 'No floor found for this store!' }, res)
        await StoreStructure.deleteMany({ floor: floorId, store: req.store })

        const filteredStructures = structures.filter(structure => {
            if (structure.type === 'blank' && !structure.merged) return false
            return true
        }).map(structure => ({ ...structure, store: req.store }))
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
        const member = await StoreMember.findOne({ store: req.params.id, user: req.user.id, isDisabled: false })
        if (!member) return response.failure(401, { msg: 'You are not a member of this store!' }, res)

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

exports.getStoreSetting = async (req, res) => {
    try {
        const setting = await StoreSetting.findOne({ store: req.store })
        if (!setting) return response.success(200, { data: await StoreSetting.create({ store: req.store }) }, res)

        return response.success(200, { data: { 
            telegramAPIKey: setting.telegramAPIKey, 
            telegramChatID: setting.telegramChatID, 
            telegramPrivilege: setting.telegramPrivilege, 
            thermalPrinterName: setting.thermalPrinterName, 
            receiptPrinterName: setting.receiptPrinterName, 
            receiptPrinterCharPerLine: setting.receiptPrinterCharPerLine, 
            thermalPrinterWidth: setting.thermalPrinterWidth, 
            thermalPrinterHeight: setting.thermalPrinterHeight, 
            thermalPrinterGap: setting.thermalPrinterGap,
            storePrinterName: setting.storePrinterName, 
            storePrinterCharPerLine: setting.storePrinterCharPerLine, 
        } }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateStoreSetting = async (req, res) => {
    const body = req.body
    const { error } = updateTelegramSettingValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        sendMessageTelegram({ text: 'Bot has been connected', token: body.telegramAPIKey, chatId: body.telegramChatID })
            .then(() => {
                StoreSetting.findOneAndUpdate({ store: req.store }, { ...body, store: req.store }, { upsert: true, new: true, setDefaultsOnInsert: true }, (err, setting) => {
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

