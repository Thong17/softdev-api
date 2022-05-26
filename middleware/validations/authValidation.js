const Joi = require('joi')

const loginValidation = Joi.object({
    username: Joi.string()
        .required(),

    password: Joi.string()
        .min(3)
        .required()
})

const registerValidation = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
        
    role: Joi.string()
        .required(),

    password: Joi.string()
        .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),

    confirm_password: Joi.valid(Joi.ref('password'))
        .required()
})

module.exports = { loginValidation, registerValidation }