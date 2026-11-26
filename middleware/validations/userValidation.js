const Joi = require('joi')

const createUserValidation = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),

    // Optional: users sign in with their username
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow('', null),

    role: Joi.string()
        .required(),

    password: Joi.string()
        .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$'))
        .required(),

    expireAt: Joi.date()
        .allow(null, ''),
})

const updateUserValidation = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow('', null),

    role: Joi.string()
        .required(),

    // Empty or left out: the password stays as it is
    password: Joi.string()
        .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$'))
        .allow(''),

    expireAt: Joi.date()
        .allow(null, ''),
})

module.exports = { createUserValidation, updateUserValidation }