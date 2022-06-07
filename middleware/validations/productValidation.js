const Joi = require('joi')

const createProductValidation = Joi.object({
    name: Joi.object().required(),
    status: Joi.boolean().optional(),
    icon: Joi.any().optional(),
    description: Joi.string().optional().allow('')
})

module.exports = {
    createProductValidation
}