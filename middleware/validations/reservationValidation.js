const Joi = require('joi')

const createReservationValidation = Joi.object({
    startAt: Joi.any().optional(),
    endAt: Joi.any().optional(),
    customer: Joi.string().required(),
    structures: Joi.array().required(),
    price: Joi.object().required(),
    note: Joi.string().optional().allow('')
})

module.exports = {
    createReservationValidation
}