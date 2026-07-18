const Joi = require('joi')

const createPromotionValidation = Joi.object({
    company: Joi.string().optional().allow(''),
    store: Joi.string().optional().allow(''),
    description: Joi.object(),
    value: Joi.number().required(),
    type: Joi.string().required(),
    startAt: Joi.date().required(),
    expireAt: Joi.date().required(),
    isFixed: Joi.boolean(),
    products: Joi.array()
})

module.exports = {
    createPromotionValidation
}