const Joi = require('joi')

const createCategoryValidation = Joi.object({
    category: Joi.object({
        English: Joi.string().required()
    }),
    status: Joi.boolean().optional(),
    icon: Joi.any().optional(),
    description: Joi.string().optional().allow('')
})

module.exports = {
    createCategoryValidation
}