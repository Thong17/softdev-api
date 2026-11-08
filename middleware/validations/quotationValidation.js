const Joi = require('joi')

const promotionSchema = Joi.object({
    value: Joi.number().allow(null, '').optional(),
    type: Joi.string().optional(),
    isFixed: Joi.boolean().optional(),
}).unknown(true)

const itemSchema = Joi.object({
    product: Joi.string().allow(null, '').optional(),
    description: Joi.string().allow('').optional(),
    price: Joi.number().required(),
    currency: Joi.string().valid('USD', 'KHR').required(),
    quantity: Joi.number().min(1).required(),
    discount: promotionSchema.optional(),
    total: Joi.object({
        value: Joi.number().required(),
        currency: Joi.string().valid('USD', 'KHR').required(),
    }).required(),
    profile: Joi.string().allow(null, '').optional(),
    note: Joi.string().allow(null, '').optional(),
    color: Joi.string().allow(null, '').optional(),
    options: Joi.array().items(Joi.string()).optional(),
    customerOption: Joi.string().allow(null, '').optional(),
})

const quotationValidation = Joi.object({
    customer: Joi.string().allow(null, '').optional(),
    items: Joi.array().items(itemSchema).min(1).required(),
    discounts: Joi.array().items(promotionSchema).optional(),
    vouchers: Joi.array().items(promotionSchema).optional(),
    services: Joi.array().items(promotionSchema).optional(),
    rate: Joi.object({
        buyRate: Joi.number().optional(),
        sellRate: Joi.number().optional(),
    }).optional(),
    note: Joi.string().allow(null, '').optional(),
    expireAt: Joi.date().allow(null, '').optional(),
})

module.exports = {
    quotationValidation
}
