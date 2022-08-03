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

module.exports = {
    createStoreValidation,
    createFloorValidation
}