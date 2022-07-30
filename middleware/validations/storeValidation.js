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

module.exports = {
    createStoreValidation
}