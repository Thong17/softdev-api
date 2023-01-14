const Joi = require('joi')

const createLoanValidation = Joi.object({
  customer: Joi.string().required(),
  payment: Joi.string().required(),
  attachments: Joi.any().optional(),
  duration: Joi.object({
    value: Joi.number(),
    time: Joi.string(),
  }),
  interest: Joi.object({
    value: Joi.number(),
    currency: Joi.string(),
  }),
  overdue: Joi.object({
    value: Joi.number(),
    currency: Joi.string(),
    duration: Joi.object({
      value: Joi.number(),
      time: Joi.string(),
    }),
  }),
  prepayment: Joi.object({
    value: Joi.number(),
    currency: Joi.string(),
    duration: Joi.object({
      value: Joi.number(),
      time: Joi.string(),
    }),
  }),
  totalPaid: Joi.object({
    KHR: Joi.number(),
    USD: Joi.number(),
    total: Joi.number(),
  }),
})

module.exports = {
  createLoanValidation,
}
