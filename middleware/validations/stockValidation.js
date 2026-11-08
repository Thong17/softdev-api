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

const convertStockValidation = Joi.object({
    fromProduct: Joi.string().required(),
    toProduct: Joi.string().invalid(Joi.ref('fromProduct')).messages({ 'any.invalid': 'Cannot convert a product into itself' }),
    newProduct: Joi.object({
        name: Joi.object().required(),
        price: Joi.number().min(0).required(),
        currency: Joi.string().valid('USD', 'KHR').required(),
        code: Joi.string().optional().allow(''),
        status: Joi.boolean().optional(),
        description: Joi.string().optional().allow(''),
        profile: Joi.string().optional().allow(null, ''),
        images: Joi.array().items(Joi.string()).optional(),
        // Default to the source product's brand and category when not given
        brand: Joi.string().optional().allow(''),
        category: Joi.string().optional().allow(''),
    }),
    // `split`: 1 source = ratio target (ream → sheets)
    // `merge`: ratio source = 1 target (sheets → ream)
    direction: Joi.string().valid('split', 'merge').default('split'),
    ratio: Joi.number().integer().min(1).required(),
    // Source units consumed; for `merge` it must be a multiple of ratio
    quantity: Joi.number().integer().min(1).required(),
    note: Joi.string().optional().allow(''),
}).xor('toProduct', 'newProduct')

module.exports = {
    createStockValidation,
    convertStockValidation
}