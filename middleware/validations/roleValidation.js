const Joi = require('joi')

const createRoleValidation = Joi.object({
    role: Joi.string()
        .required(),

    description: Joi.string(),

    privilege: Joi.object()
})

module.exports = { createRoleValidation }