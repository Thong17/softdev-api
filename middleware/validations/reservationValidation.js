const Joi = require('joi')

const createReservationValidation = Joi.object({
    company: Joi.string().optional().allow(''),
    store: Joi.string().optional().allow(''),
    startAt: Joi.any().optional(),
    endAt: Joi.any().optional(),
    customer: Joi.string().optional(),
    structures: Joi.array().required(),
    price: Joi.object().required(),
    note: Joi.string().optional().allow('')
})

module.exports = {
    createReservationValidation
}