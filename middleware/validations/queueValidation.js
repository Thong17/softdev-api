const Joi = require('joi')

const createQueueValidation = Joi.object({
    payment: Joi.string().required(),
})

module.exports = {
    createQueueValidation
}