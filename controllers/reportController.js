const Payment = require('../models/Payment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const moment = require('moment')

exports.sale = async (req, res) => {
  const chart = req.query._chartDate || 'daily'
  const income = req.query._totalIncome || 'day'
  const profit = req.query._totalProfit || 'day'

  try {
    const totalIncome = await Payment.find({
      createdAt: {
        $gte: moment().startOf(income).toDate(),
        $lt: moment().endOf(income).toDate(),
      },
      status: true,
    }).select('total rate transactions').populate('transactions', 'stockCosts')

    const totalProfit = await Payment.find({
      createdAt: {
        $gte: moment().startOf(profit).toDate(),
        $lt: moment().endOf(profit).toDate(),
      },
      status: true,
    }).select('total rate transactions').populate('transactions', 'stockCosts')

    return response.success(200, { data: { totalIncome, totalProfit } }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}
