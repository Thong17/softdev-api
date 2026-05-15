const Joi = require('joi')

const discountSchema = Joi.object({
    type: Joi.string().valid('product', 'category', 'brand').required(),
    target: Joi.string().required(),
    discountType: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().min(0).required()
})

const createMembershipValidation = Joi.object({
    description: Joi.object().required(),
    discounts: Joi.array().items(discountSchema).min(1).required(),
    startAt: Joi.date().required(),
    expireAt: Joi.date().required().greater(Joi.ref('startAt')),
    note: Joi.string().optional(),
    isActive: Joi.boolean().default(true)
})

module.exports = {
    createMembershipValidation
}