const Joi = require('joi')

const createPaymentValidation = Joi.object({
    transactions: Joi.array().required(),
    services: Joi.array().required(),
    discounts: Joi.array().required(),
    vouchers: Joi.array().required(),
    customer: Joi.string().optional().allow(null)
})

const checkoutPaymentValidation = Joi.object({
    receiveCashes: Joi.array().required(),
    receiveTotal: Joi.object().required(),
    remainTotal: Joi.object().required(),
    customer: Joi.string().optional().allow(null),
    paymentMethod: Joi.string().optional().allow(null)
})

module.exports = {
    createPaymentValidation,
    checkoutPaymentValidation
}