const Joi = require('joi')

const createDrawerValidation = Joi.object({
    company: Joi.string().optional().allow(''),
    store: Joi.string().optional().allow(''),
    buyRate: Joi.number().required(),
    sellRate: Joi.number().required(),
    cashes: Joi.array(),
})

module.exports = {
    createDrawerValidation
}