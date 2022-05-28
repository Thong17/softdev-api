const Joi = require('joi')

const createRoleValidation = Joi.object({
    name: Joi.object()
        .required(),

    description: Joi.string()
        .allow(''),

    privilege: Joi.object()
        .required()
})

module.exports = { createRoleValidation }