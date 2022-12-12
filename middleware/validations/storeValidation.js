const Joi = require('joi')

const createStoreValidation = Joi.object({
    name: Joi.string().optional(),
    type: Joi.string().optional(),
    tax: Joi.number().optional(),
    font: Joi.string().optional(),
    contact: Joi.string().optional(),
    logo: Joi.any().optional(),
    address: Joi.string().optional().allow(''),
    other: Joi.string().optional().allow('')
})

const createFloorValidation = Joi.object({
    floor: Joi.string().required(),
    order: Joi.number().required(),
    description: Joi.string().optional().allow('')
})

const transferValidation = Joi.object({
    title: Joi.string().required(),
    image: Joi.any().optional(),
})

const updateTelegramSettingValidation = Joi.object({
    telegramAPIKey: Joi.string().required(),
    telegramChatID: Joi.string().required(),
    telegramPrivilege: Joi.object().required(),
})

module.exports = {
    createStoreValidation,
    createFloorValidation,
    transferValidation,
    updateTelegramSettingValidation
}