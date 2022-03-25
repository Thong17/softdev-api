const Joi = require('joi')

const loginValidation = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),

    password: Joi.string()
        .min(3)
        .required()
})

const signUpValidation = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),

    password: Joi.string()
        .min(3)
        .required(),
       
    confirm_password: Joi.string()
        .required()
        .valid(Joi.ref('password'))
})

module.exports = { loginValidation, signUpValidation }