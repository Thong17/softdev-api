const Joi = require('joi')

const createPresetCashValidation = Joi.object({
    name: Joi.string().required(),
})

module.exports = {
    createPresetCashValidation
}