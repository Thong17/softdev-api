const Joi = require('joi')

const createCategoryValidation = Joi.object({
    name: Joi.object().required(),
    status: Joi.boolean().optional(),
    icon: Joi.any().optional(),
    hasThermalPrinting: Joi.boolean().optional(),
    description: Joi.string().optional().allow('')
})

module.exports = {
    createCategoryValidation
}