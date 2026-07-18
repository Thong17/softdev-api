const Joi = require('joi')

const createStoreValidation = Joi.object({
    company: Joi.string().optional().allow(''),
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
    telegramAPIKey: Joi.string().optional().allow(''),
    telegramChatID: Joi.string().optional().allow(''),
    telegramPrivilege: Joi.object().optional(),
    thermalPrinterName: Joi.string().optional().allow(''),
    receiptPrinterName: Joi.string().optional().allow(''),
    receiptPrinterCharPerLine: Joi.number().optional().allow(''),
    thermalPrinterWidth: Joi.number().optional().allow(''),
    thermalPrinterHeight: Joi.number().optional().allow(''),
    thermalPrinterGap: Joi.number().optional().allow(''),
    storePrinterName: Joi.string().optional().allow(''),
    storePrinterCharPerLine: Joi.number().optional().allow(''),
})

module.exports = {
    createStoreValidation,
    createFloorValidation,
    transferValidation,
    updateTelegramSettingValidation
}