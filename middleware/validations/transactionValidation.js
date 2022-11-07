const Joi = require('joi')

const createTransactionValidation = Joi.object({
    description: Joi.string().required(),
    product: Joi.string().required(),
    color: Joi.string().optional().allow(null),
    customer: Joi.string().optional().allow(null),
    price: Joi.number().required(),
    currency: Joi.string().required(),
    total: Joi.object().required(),
    quantity: Joi.number().required(),
    options: Joi.array().required(),
    promotion: Joi.any().optional()
})

const updateTransactionValidation = Joi.object({
    description: Joi.string().required(),
    price: Joi.number().required(),
    currency: Joi.string().required(),
    quantity: Joi.number().required(),
    note: Joi.string().optional().allow(''),
    discount: Joi.object().required()
})

const stockTransactionValidation = Joi.object({
    stock: Joi.string().required(),
    quantity: Joi.number().required(),
})

module.exports = {
    createTransactionValidation,
    updateTransactionValidation,
    stockTransactionValidation
}