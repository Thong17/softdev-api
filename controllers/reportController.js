const Payment = require('../models/Payment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const moment = require('moment')

exports.sale = async (req, res) => {
  const chart = req.query._chartData || 'day'
  const income = req.query._totalIncome || 'day'
  const profit = req.query._totalProfit || 'day'

  try {
    // Total Income
    const incomePayment = await Payment.find({
      createdAt: {
        $gte: moment().startOf(income).toDate(),
        $lt: moment().endOf(income).toDate(),
      },
      status: true,
    }).select('total rate transactions createdAt').populate('transactions', 'stockCosts')
    let totalIncome = 0
    incomePayment.forEach(payment => {
        const { buyRate } = payment.rate
        let paymentTotal = payment.total.value
        if (payment.total.currency !== 'USD') paymentTotal /= buyRate
        totalIncome += paymentTotal
    }) 

    // Total Profit
    const profitPayment = await Payment.find({
      createdAt: {
        $gte: moment().startOf(profit).toDate(),
        $lt: moment().endOf(profit).toDate(),
      },
      status: true,
    }).select('total rate transactions createdAt').populate('transactions', 'stockCosts')
    let totalProfit = 0
    profitPayment.forEach(payment => {
        const { buyRate } = payment.rate
        let paymentTotal = payment.total.value
        if (payment.total.currency !== 'USD') paymentTotal /= buyRate

        let costTotal = 0
        payment.transactions.forEach(transaction => {
            transaction.stockCosts.forEach(stock => {
                costTotal += stock.currency !== 'USD' ? stock.cost / buyRate : stock.cost
            })
        })
        totalProfit = paymentTotal - costTotal
    })

    // List Sale
    const listPayment = await Payment.find({
        createdAt: {
          $gte: moment().startOf(chart).toDate(),
          $lt: moment().endOf(chart).toDate(),
        },
        status: true,
      }).select('total rate transactions createdAt').populate('transactions', 'stockCosts')
    const listSale = []

    let label = ''
    let format = ''
    switch (chart) {
        case 'day':
            label = 'hour'
            format = '[Today] ha'
            break
        case 'week':
            label = 'day'
            format = 'MMM Do'
            break
        case 'month':
            label = 'week'
            format = 'MMM YYYY'
            break
        default:
            label = 'month'
            format = 'YYYY'
            break
    }
    listPayment.forEach(payment => {
        const { buyRate } = payment.rate
        const isInList = listSale.some(item => moment(item.name).isSame(payment.createdAt, label))
        if (!isInList) {
            listSale.push({ name: payment.createdAt, value: payment.total.value, format })
        } else {
            listSale.map(item => {
                if (moment(item.name).isSame(payment.createdAt, label)) {
                    let totalPayment = payment.total.value
                    if (payment.total.currency !== 'USD') totalPayment /= buyRate
                    item.value = item.value + totalPayment
                } else return item
            })
        }
    })

    return response.success(200, { data: { totalIncome, totalProfit, listSale } }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}
