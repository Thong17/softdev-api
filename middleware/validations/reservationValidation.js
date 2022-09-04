const Joi = require('joi')

const createReservationValidation = Joi.object({
    startAt: Joi.any().required(),
    endAt: Joi.any().required(),
    customer: Joi.string().required(),
    structures: Joi.array().required(),
    price: Joi.object().required(),
    note: Joi.string().optional().allow('')
})

module.exports = {
    createReservationValidation
}