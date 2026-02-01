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

const checkoutLoanValidation = Joi.object({
  receiveCashes: Joi.array().required(),
  receiveTotal: Joi.object().required(),
  total: Joi.object().required(),
  remainTotal: Joi.object().required(),
  customer: Joi.string().optional().allow(null),
  paymentMethod: Joi.string().optional().allow(null)
})

const loanWriteOffValidation = Joi.object({
  transactions: Joi.array()
    .items(
      Joi.alternatives().conditional(
        Joi.object({
          writeOffType: Joi.valid('REPOSSESS'),
        }).unknown(),
        {
          then: Joi.object({
            writeOffType: Joi.string().required(),
            remainingCostCurrency: Joi.string().required(),
            remainingCost: Joi.number().required(),
            newPrice: Joi.number().required(),
            newPriceCurrency: Joi.string().required(),
            condition: Joi.string().required(),
            reason: Joi.string().optional(),
            note: Joi.string().optional(),
            id: Joi.string().required()
          }),
          otherwise: Joi.object({
            writeOffType: Joi.string().required(),
            currency: Joi.string().required(),
            amount: Joi.number().required(),
            note: Joi.string().optional(),
            id: Joi.string().required(),
            condition: Joi.string().required(),
            reason: Joi.string().optional(),
          })
        }
      )
    )
    .min(1)
    .messages({
      'array.min': 'At least one user is required',
      'any.required': 'Transactions is required',
    }),
})

module.exports = {
  createLoanValidation,
  checkoutLoanValidation,
  loanWriteOffValidation
}
