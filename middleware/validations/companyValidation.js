const Joi = require('joi')

const createCompanyValidation = Joi.object({
    name: Joi.object().required(),
    legalName: Joi.string().optional().allow(''),
    status: Joi.boolean().optional(),
    contact: Joi.string().optional().allow(''),
    email: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow(''),
    logo: Joi.any().optional(),
})

module.exports = {
    createCompanyValidation
}
