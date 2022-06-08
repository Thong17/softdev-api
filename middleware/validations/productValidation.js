const Joi = require('joi')

const createProductValidation = Joi.object({
    name: Joi.object().required(),
    price: Joi.number().required(),
    currency: Joi.string().required(),
    code: Joi.string().optional().allow(''),
    status: Joi.boolean().optional(),
    description: Joi.string().optional().allow(''),
    isStock: Joi.boolean().optional(),
    profile: Joi.any().optional(),
    brand: Joi.string().required(),
    category: Joi.string().required()
})

const updateValueValidation = Joi.object({
    colors: Joi.array().optional(),
    options: Joi.array().optional(),
    images: Joi.array().optional()
})

module.exports = {
    createProductValidation,
    updateValueValidation
}