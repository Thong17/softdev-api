const Joi = require('joi')

const createBrandValidation = Joi.object({
    company: Joi.string().optional().allow(''),
    store: Joi.string().optional().allow(''),
    name: Joi.object().required(),
    status: Joi.boolean().optional(),
    icon: Joi.any().optional(),
    description: Joi.string().optional().allow('')
})

module.exports = {
    createBrandValidation
}