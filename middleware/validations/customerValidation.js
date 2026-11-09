const Joi = require('joi')

const createCustomerValidation = Joi.object({
    displayName: Joi.string().required(),
    fullName: Joi.string().optional().allow(''),
    dateOfBirth: Joi.any().optional(),
    contact: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow(''),
    picture: Joi.any().optional(),
    type: Joi.string().valid('INDIVIDUAL', 'BUSINESS').optional(),
    companyName: Joi.string().optional().allow(''),
    contactPerson: Joi.string().optional().allow(''),
    taxId: Joi.string().optional().allow(''),
    email: Joi.string().email({ tlds: { allow: false } }).optional().allow(''),
    telegram: Joi.string().optional().allow(''),
    priceTier: Joi.string().valid('RETAIL', 'WHOLESALE', 'VIP').optional(),
    discount: Joi.number().min(0).max(100).optional().allow(null),
    group: Joi.string().optional().allow(''),
    tier: Joi.string().optional().allow('', null),
    tierLocked: Joi.boolean().optional(),
    source: Joi.string().optional().allow(''),
    note: Joi.string().optional().allow(''),
    location: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required(),
        label: Joi.string().optional().allow(''),
    }).optional().allow(null),
})

module.exports = {
    createCustomerValidation
}