const Joi = require('joi')

const createDrawerValidation = Joi.object({
    buyRate: Joi.number().required(),
    sellRate: Joi.number().required(),
    cashes: Joi.array(),
})

module.exports = {
    createDrawerValidation
}