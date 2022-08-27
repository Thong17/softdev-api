const Joi = require('joi')

const createDrawerValidation = Joi.object({
    buyRate: Joi.number().required(),
    sellRate: Joi.number().optional(),
    cashes: Joi.array(),
})

module.exports = {
    createDrawerValidation
}