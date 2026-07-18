const Joi = require('joi')

const createQueueValidation = Joi.object({
    company: Joi.string().optional().allow(''),
    store: Joi.string().optional().allow(''),
    payment: Joi.string().required(),
})

module.exports = {
    createQueueValidation
}