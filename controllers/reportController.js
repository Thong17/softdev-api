const Payment = require('../models/Payment')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const moment = require('moment')
const LoanPayment = require('../models/LoanPayment')
const TransactionClearance = require('../models/TransactionClearance')
const { installmentsBetween } = require('../helpers/payLaterRevenue')

// A sale's items, each once and without removed cart lines. Older sales can
// list an item twice, which counted it twice in the product figures.
const soldItems = (payment) => {
  const seen = new Set()
  return (payment.transactions || []).filter((transaction) => {
    if (!transaction || transaction.isDeleted) return false
    const key = String(transaction._id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

exports.listSale = async (req, res) => {
  const rawChart = req.query._chartData || 'hourly'
  const qFrom = req.query.fromDate
  const qTo = req.query.toDate

  // map incoming chart terms to moment units / grouping behavior
  const unitMap = {
    hourly: 'hour',
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  }

  const fromMoment = qFrom ? moment(qFrom) : moment()
  const toMoment = qTo ? moment(qTo) : moment()

  const query = { $gte: fromMoment.startOf('day').toDate(), $lt: toMoment.endOf('day').toDate() }

  try {
    // List Sale
    const listPayment = await Payment.find({
        createdAt: query,
        status: true,
        paymentMethod: { $ne: 'loan' },
        // Pay Later sales count as their money arrives (installments below)
        isPayLater: { $ne: true },
      }).select('total rate transactions createdAt').populate('transactions', 'stockCosts')
    const listSale = []

    // determine grouping label and format based on requested chart
    const label = Object.prototype.hasOwnProperty.call(unitMap, rawChart) ? unitMap[rawChart] : 'day'
    const formatMap = {
      hourly: 'Do ha',
      daily: 'MMM Do',
      weekly: 'MMM Do',
      monthly: 'Do MMM YYYY',
      yearly: 'MMM YYYY',
    }
    const format = formatMap[rawChart] || 'MMM Do'

    const incomeLoanPayment = await LoanPayment.find({
      paymentDate: query,
      isPaid: true
    }).select('totalAmount isPaid loan paymentDate')
      .populate({ 
        path: 'loan', 
        populate: { 
          path: 'payment', 
          select: 'rate transactions',
          populate: {
            path: 'transactions',
            select: 'stockCosts'
          }
        } 
      })

    listPayment.push(incomeLoanPayment.map(loanPayment => ({
      total: loanPayment.totalAmount,
      rate: loanPayment.loan.payment.rate,
      createdAt: loanPayment.paymentDate
    })))

    // Pay Later: each amount received, on the day it was received
    const payLaterReceived = await installmentsBetween(query)
    listPayment.push(payLaterReceived.map(installment => ({
      total: { value: installment.income, currency: 'USD' },
      rate: installment.payment?.rate,
      createdAt: installment.paidAt
    })))

    // normalize payments and group according to label (or emit each item when label === null)
    listPayment.flat().forEach(payment => {
      const buyRate = payment.rate?.buyRate || 1
      let totalPayment = payment.total?.value || 0
      if (payment.total?.currency && payment.total.currency !== 'USD') totalPayment /= buyRate

      if (!label) {
        // item mode: push each payment as its own entry
        listSale.push({ name: payment.createdAt, value: totalPayment, format })
        return
      }

      const isInList = listSale.some(item => moment(item.name).isSame(payment.createdAt, label))
      if (!isInList) {
        listSale.push({ name: payment.createdAt, value: totalPayment, format })
      } else {
        listSale.forEach(item => {
          if (moment(item.name).isSame(payment.createdAt, label)) {
            item.value = item.value + totalPayment
          }
        })
      }
    })

    return response.success(200, { data: listSale }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

// Report periods: today, this week, this month or this year
const PERIODS = ['day', 'week', 'month', 'year']
const periodRange = (period) => {
  const unit = PERIODS.includes(period) ? period : 'day'
  return { $gte: moment().startOf(unit).toDate(), $lt: moment().endOf(unit).toDate() }
}

const toUSD = (value, currency, buyRate) => (currency && currency !== 'USD' ? value / (buyRate || 1) : value)

// What the sold items cost, from the stock each one was taken from
const itemsCost = (transactions, buyRate) => (transactions || []).reduce((total, transaction) => {
  return total + (transaction?.stockCosts || []).reduce((sum, stock) => sum + toUSD(stock.cost, stock.currency, buyRate), 0)
}, 0)

const sumOf = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0)

// Money received in a date range, by where it came from, with what the sold
// items cost. The Income and Profit cards and their "how it's calculated"
// dialogs all come from here, so they always agree. Each source gives one
// row per sale or payment:
//   sales       paid sales (not installment or Pay Later sales): total − items' cost
//   loan        installment payments received: amount − items' cost ÷ number of installments
//   clearance   installment items paid off early: amount − that item's cost
//   payLater    Pay Later money received: amount − its share of the items' cost
const sourceRows = {
  sales: async (range) => {
    const payments = await Payment.find({ createdAt: range, paymentMethod: { $ne: 'loan' }, isPayLater: { $ne: true }, status: true })
      .select('invoice total rate transactions createdAt')
      .populate('transactions', 'stockCosts')
    return payments.map((payment) => {
      const buyRate = payment.rate?.buyRate
      const income = toUSD(payment.total?.value || 0, payment.total?.currency, buyRate)
      const cost = itemsCost(payment.transactions, buyRate)
      return { id: payment._id, invoice: payment.invoice, date: payment.createdAt, income, cost, profit: income - cost }
    })
  },
  loan: async (range) => {
    const loanPayments = await LoanPayment.find({ paymentDate: range, isPaid: true })
      .select('totalAmount isPaid loan paymentDate')
      .populate({ path: 'loan', populate: { path: 'payment', select: 'invoice rate transactions', populate: { path: 'transactions', select: 'stockCosts' } } })
    return loanPayments.map((loanPayment) => {
      const buyRate = loanPayment.loan?.payment?.rate?.buyRate
      const income = toUSD(loanPayment.totalAmount?.value || 0, loanPayment.totalAmount?.currency, buyRate)
      const installmentCount = loanPayment.loan?.loanPayments?.length || 1
      const fullCost = itemsCost(loanPayment.loan?.payment?.transactions, buyRate)
      const cost = fullCost / installmentCount
      return { id: loanPayment._id, invoice: loanPayment.loan?.payment?.invoice, date: loanPayment.paymentDate, income, cost, profit: income - cost, fullCost, installmentCount }
    })
  },
  clearance: async (range) => {
    const clearances = await TransactionClearance.find({ createdAt: range })
      .select('transaction amount currency type createdAt')
      .populate('transaction', 'stockCosts')
      .populate({ path: 'loan', select: 'payment', populate: { path: 'payment', select: 'invoice rate' } })
    return clearances.map((item) => {
      const buyRate = item.loan?.payment?.rate?.buyRate
      const income = toUSD(item.amount || 0, item.currency, buyRate)
      const cost = itemsCost([item.transaction], buyRate)
      return { id: item._id, invoice: item.loan?.payment?.invoice, date: item.createdAt, income, cost, profit: income - cost }
    })
  },
  payLater: async (range) => {
    const installments = await installmentsBetween(range)
    return installments.map((installment) => ({
      id: installment._id,
      invoice: installment.payment?.invoice,
      date: installment.paidAt,
      income: installment.income,
      cost: installment.cost,
      profit: installment.profit,
    }))
  },
}
const SOURCES = Object.keys(sourceRows)

// Each source's totals for a date range, and the totals of them all
const saleBreakdown = async (range) => {
  const rowsBySource = await Promise.all(SOURCES.map((key) => sourceRows[key](range)))
  const sources = SOURCES.map((key, index) => {
    const rows = rowsBySource[index]
    return { key, count: rows.length, income: sumOf(rows, 'income'), cost: sumOf(rows, 'cost'), profit: sumOf(rows, 'profit') }
  })
  return {
    from: range.$gte,
    to: range.$lt || range.$lte,
    sources,
    income: sumOf(sources, 'income'),
    cost: sumOf(sources, 'cost'),
    profit: sumOf(sources, 'profit'),
  }
}

exports.totalSale = async (req, res) => {
  const income = PERIODS.includes(req.query._totalIncome) ? req.query._totalIncome : 'day'
  const profit = PERIODS.includes(req.query._totalProfit) ? req.query._totalProfit : 'day'

  try {
    // Each card counts its own period
    const incomeBreakdown = await saleBreakdown(periodRange(income))
    const profitBreakdown = profit === income ? incomeBreakdown : await saleBreakdown(periodRange(profit))
    return response.success(200, { data: { totalIncome: incomeBreakdown.income, totalProfit: profitBreakdown.profit } }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

// The dialog's range: fromDate and toDate (date-times) when given, otherwise
// the card's period (?type=income|profit with _totalIncome / _totalProfit)
const breakdownRange = (query) => {
  if (query.fromDate || query.toDate) {
    // ISO date-times only (the dialog sends toISOString())
    const from = query.fromDate ? moment(query.fromDate, moment.ISO_8601, true) : null
    const to = query.toDate ? moment(query.toDate, moment.ISO_8601, true) : null
    if ((from && !from.isValid()) || (to && !to.isValid())) return { error: 'The date is not valid' }
    if (from && to && from.isAfter(to)) return { error: 'The start must be before the end' }
    return { range: { ...(from && { $gte: from.toDate() }), ...(to && { $lte: to.toDate() }) } }
  }
  const period = query.type === 'profit' ? query._totalProfit : query._totalIncome
  return { range: periodRange(period) }
}

// How the Income or Profit card is worked out: the range and each source's
// totals. The sales and payments behind a source come from the rows endpoint.
exports.totalSaleBreakdown = async (req, res) => {
  const { range, error } = breakdownRange(req.query)
  if (error) return response.failure(422, { msg: error }, res)
  try {
    const breakdown = await saleBreakdown(range)
    return response.success(200, { data: breakdown }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

// One page of the sales and payments in the range: of one source, or of
// all of them ('all', each row naming its source). `search` matches the
// invoice; `sort` is by date, 'desc' (newest first, default) or 'asc'.
// `total` adds up every row that matched, not only this page.
exports.totalSaleBreakdownRows = async (req, res) => {
  const source = SOURCES.includes(req.query.source) ? req.query.source : 'all'
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100)
  const page = Math.max(parseInt(req.query.page) || 0, 0)
  const { range, error } = breakdownRange(req.query)
  if (error) return response.failure(422, { msg: error }, res)
  try {
    const keys = source === 'all' ? SOURCES : [source]
    const bySource = await Promise.all(keys.map((key) => sourceRows[key](range)))
    const search = String(req.query.search || '').trim().toLowerCase()
    const direction = req.query.sort === 'asc' ? 1 : -1
    const rows = bySource
      .flatMap((items, index) => items.map((row) => ({ ...row, source: keys[index] })))
      .filter((row) => !search || String(row.invoice || '').toLowerCase().includes(search))
      .sort((a, b) => direction * (new Date(a.date) - new Date(b.date)))
    const total = { income: sumOf(rows, 'income'), cost: sumOf(rows, 'cost'), profit: sumOf(rows, 'profit') }
    return response.success(200, { data: rows.slice(page * limit, page * limit + limit), length: rows.length, total, page, limit, source }, res)
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
    }).select('transactions rate').populate({ path: 'transactions', populate: { path: 'product', select: 'name profile', populate: { path: 'profile', select: 'filename' } } })
    
    const listProduct = []
    payments.forEach(payment => {
      const { buyRate } = payment.rate
      soldItems(payment).forEach(transaction => {
        if (!transaction.product) return
        const isInList = listProduct.some(item => item.id.equals(transaction.product._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : transaction.total.value / buyRate

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
  let query = {}
  if (chart === 'range') {
    const fromDate = moment(req.query.fromDate)
    const toDate = moment(req.query.toDate)
    if (fromDate.isValid() && toDate.isValid()) {
      query = {
        $gte: fromDate.toDate(),
        $lt: toDate.toDate(),
      }
    } else {
      query = {
        $gte: moment().toDate(),
        $lt: moment().toDate(),
      }
    }
  } else {
    query = {
      $gte: moment().startOf(chart).toDate(),
      $lt: moment().endOf(chart).toDate(),
    }
  }

  try {
    // List Product
    const chartPayments = await Payment.find({
      createdAt: query,
      status: true,
    }).select('transactions rate').populate({ path: 'transactions', populate: { path: 'product', select: 'name profile', populate: { path: 'profile', select: 'filename' } } })
    
    const listProductSale = []
    chartPayments.forEach(payment => {
      const { buyRate } = payment.rate
      soldItems(payment).forEach(transaction => {
        if (!transaction.product) return
        const isInList = listProductSale.some(item => item.id.equals(transaction.product._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : transaction.total.value / buyRate

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
    }).select('transactions rate').populate({ path: 'transactions', populate: { path: 'createdBy', select: 'username profile', populate: { path: 'profile', populate: { path: 'photo', select: 'filename' } } } })
    
    const listTopStaff = []
    payments.forEach(payment => {
      const { buyRate } = payment.rate
      soldItems(payment).forEach(transaction => {
        if (!transaction.createdBy) return
        const isInList = listTopStaff.some(item => item.id.equals(transaction.createdBy._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : transaction.total.value / buyRate

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
  let query = {}
  if (chart === 'range') {
    const fromDate = moment(req.query.fromDate)
    const toDate = moment(req.query.toDate)
    if (fromDate.isValid() && toDate.isValid()) {
      query = {
        $gte: fromDate.toDate(),
        $lt: toDate.toDate(),
      }
    } else {
      query = {
        $gte: moment().toDate(),
        $lt: moment().toDate(),
      }
    }
  } else {
    query = {
      $gte: moment().startOf(chart).toDate(),
      $lt: moment().endOf(chart).toDate(),
    }
  }

  try {
    // List Staff
    const chartPayments = await Payment.find({
      createdAt: query,
      status: true,
    }).select('transactions rate').populate({ path: 'transactions', populate: { path: 'createdBy', select: 'username' } })
    
    const listStaff = []
    chartPayments.forEach(payment => {
      const { buyRate } = payment.rate
      soldItems(payment).forEach(transaction => {
        if (!transaction.createdBy) return
        const isInList = listStaff.some(item => item.id.equals(transaction.createdBy._id))
        const transactionTotal = transaction.total.currency === 'USD' ? transaction.total.value : transaction.total.value / buyRate

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

