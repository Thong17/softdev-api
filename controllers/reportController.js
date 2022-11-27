const Payment = require('../models/Payment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const moment = require('moment')

exports.listSale = async (req, res) => {
  const chart = req.query._chartData || 'day'

  try {
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
            format = 'Do MMM YYYY'
            break
        default:
            label = 'month'
            format = 'MMM YYYY'
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

    return response.success(200, { data: listSale }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.totalSale = async (req, res) => {
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

    return response.success(200, { data: { totalIncome, totalProfit } }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.topProduct = async (req, res) => {
  const income = req.query._topProduct || 'month'

  try {
    // Top Product
    const payments = await Payment.find({
      createdAt: {
        $gte: moment().startOf(income).toDate(),
        $lt: moment().endOf(income).toDate(),
      },
      status: true,
    }).select('transactions').populate({ path: 'transactions', populate: { path: 'product', select: 'name profile', populate: { path: 'profile', select: 'filename' } } })
    
    const listProduct = []
    payments.forEach(payment => {
      payment.transactions?.forEach(transaction => {
        if (!transaction.product) return
        const isInList = listProduct.some(item => item.id.equals(transaction.product._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : payment.transaction.total.value / buyRate

        if (!isInList) {
          listProduct.push({ id: transaction.product._id, name: transaction.product.name, picture: transaction.product.profile?.filename, value: transactionTotal })
        } else {
          listProduct.map(item => {
            if (item.id.equals(transaction.product._id)) {
                item.value = item.value + transactionTotal
            } else return item
          })
        }
      })
    })
    const topProduct = listProduct.length && listProduct.reduce((a, b) => a.value > b.value ? a : b)
    return response.success(200, { data: topProduct }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.listProduct = async (req, res) => {
  const chart = req.query._chartData || 'month'

  try {
    // List Product
    const chartPayments = await Payment.find({
      createdAt: {
        $gte: moment().startOf(chart).toDate(),
        $lt: moment().endOf(chart).toDate(),
      },
      status: true,
    }).select('transactions').populate({ path: 'transactions', populate: { path: 'product', select: 'name profile', populate: { path: 'profile', select: 'filename' } } })
    
    const listProductSale = []
    chartPayments.forEach(payment => {
      payment.transactions?.forEach(transaction => {
        if (!transaction.product) return
        const isInList = listProductSale.some(item => item.id.equals(transaction.product._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : payment.transaction.total.value / buyRate

        if (!isInList) {
          listProductSale.push({ id: transaction.product._id, name: transaction.product.name, value: transactionTotal })
        } else {
          listProductSale.map(item => {
            if (item.id.equals(transaction.product._id)) {
                item.value = item.value + transactionTotal
            } else return item
          })
        }
      })
    })

    return response.success(200, { data: listProductSale }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.topStaff = async (req, res) => {
  const income = req.query._topProduct || 'month'

  try {
    // Top Staff
    const payments = await Payment.find({
      createdAt: {
        $gte: moment().startOf(income).toDate(),
        $lt: moment().endOf(income).toDate(),
      },
      status: true,
    }).select('transactions').populate({ path: 'transactions', populate: { path: 'createdBy', select: 'username profile', populate: { path: 'profile', populate: { path: 'photo', select: 'filename' } } } })
    
    const listTopStaff = []
    payments.forEach(payment => {
      payment.transactions?.forEach(transaction => {
        if (!transaction.createdBy) return
        const isInList = listTopStaff.some(item => item.id.equals(transaction.createdBy._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : payment.transaction.total.value / buyRate

        if (!isInList) {
          listTopStaff.push({ id: transaction.createdBy._id, name: transaction.createdBy.username, picture: transaction.createdBy.profile?.photo, value: transactionTotal })
        } else {
          listTopStaff.map(item => {
            if (item.id.equals(transaction.createdBy._id)) {
                item.value = item.value + transactionTotal
            } else return item
          })
        }
      })
    })
    const topStaff = listTopStaff.length && listTopStaff.reduce((a, b) => a.value > b.value ? a : b)
    return response.success(200, { data: topStaff }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.listStaff = async (req, res) => {
  const chart = req.query._chartData || 'month'

  try {
    // List Staff
    const chartPayments = await Payment.find({
      createdAt: {
        $gte: moment().startOf(chart).toDate(),
        $lt: moment().endOf(chart).toDate(),
      },
      status: true,
    }).select('transactions').populate({ path: 'transactions', populate: { path: 'createdBy', select: 'username' } })
    
    const listStaff = []
    chartPayments.forEach(payment => {
      payment.transactions?.forEach(transaction => {
        if (!transaction.createdBy) return
        const isInList = listStaff.some(item => item.id.equals(transaction.createdBy._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : payment.transaction.total.value / buyRate

        if (!isInList) {
          listStaff.push({ id: transaction.createdBy._id, name: transaction.createdBy.username, value: transactionTotal })
        } else {
          listStaff.map(item => {
            if (item.id.equals(transaction.createdBy._id)) {
                item.value = item.value + transactionTotal
            } else return item
          })
        }
      })
    })

    return response.success(200, { data: listStaff }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

