const Joi = require('joi')

const createStockValidation = Joi.object({
    cost: Joi.number().required(),
    currency: Joi.string().required(),
    quantity: Joi.number().required(),
    code: Joi.string().optional().allow(''),
    expireAt: Joi.date().optional().allow(null),
    alertAt: Joi.number().optional(),
    color: Joi.string().optional(),
    product: Joi.string().required(),
    options: Joi.array().optional(),
    customers: Joi.array().optional(),
})

module.exports = {
    createStockValidation
}