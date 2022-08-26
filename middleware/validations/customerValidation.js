const Joi = require('joi')

const createCustomerValidation = Joi.object({
    displayName: Joi.string().required(),
    fullName: Joi.string().optional().allow(''),
    dateOfBirth: Joi.any().optional(),
    contact: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow(''),
    picture: Joi.any().optional(),
})

module.exports = {
    createCustomerValidation
}