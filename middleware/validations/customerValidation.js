const Joi = require('joi')

const createCustomerValidation = Joi.object({
    lastName: Joi.string().required(),
    firstName: Joi.string().required(),
    dateOfBirth: Joi.string().required(),
    phone: Joi.string().required(),
    address: Joi.string().optional().allow('')
})

module.exports = {
    createCustomerValidation
}