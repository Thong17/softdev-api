const Joi = require('joi')

const createAnnouncementValidation = Joi.object({
    title: Joi.object().required(),
    description: Joi.object(),
    banner: Joi.string().required(),
    status: Joi.boolean(),
    startAt: Joi.date().required(),
    expireAt: Joi.date().required(),
    order: Joi.number()
})

module.exports = {
    createAnnouncementValidation
}
