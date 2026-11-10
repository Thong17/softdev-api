// Excel exports for the reports. Each one uses the same rules as the report
// screen it belongs to, for the chosen date range:
// - sales: completed payments (not loan sales) by creation date, plus paid loan
//   installments by payment date and loan write-off clearances
// - product / staff: completed payments by creation date, including items sold
//   on loan (as the Product and Staff report screens count them)
// - inventory: stock on hand right now
const moment = require('moment')
const Payment = require('../models/Payment')
const LoanPayment = require('../models/LoanPayment')
const TransactionClearance = require('../models/TransactionClearance')
const Product = require('../models/Product')
const ProductStock = require('../models/ProductStock')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { canViewCost } = require('../helpers/stockCost')
const { Workbook, addSheet, sendWorkbook, formats } = require('../helpers/excel')
const { installmentsBetween } = require('../helpers/payLaterRevenue')

const nameOf = (item, lang = 'English') => item?.name?.[lang] || item?.name?.English || (typeof item?.name === 'string' ? item.name : '') || ''

// Same defaults as the report screens: today when no range is given
const dateRange = (query) => {
    const from = moment(query.fromDate || undefined, 'YYYY-MM-DD')
    const to = moment(query.toDate || undefined, 'YYYY-MM-DD')
    const fromMoment = from.isValid() ? from : moment()
    const toMoment = to.isValid() ? to : moment()
    return {
        filter: { $gte: fromMoment.clone().startOf('day').toDate(), $lt: toMoment.clone().endOf('day').toDate() },
        label: `${fromMoment.format('YYYY-MM-DD')}_${toMoment.format('YYYY-MM-DD')}`,
    }
}

const toUSD = (value, currency, buyRate) => {
    const amount = Number(value) || 0
    return currency && currency !== 'USD' ? amount / (buyRate || 4000) : amount
}

const costOf = (transaction, buyRate) => (transaction?.stockCosts || [])
    .reduce((sum, stock) => sum + toUSD(stock.cost, stock.currency, buyRate), 0)

const completedPayments = (filter, populate, { includeLoan = false } = {}) => Payment.find({
    createdAt: filter,
    status: true,
    ...(!includeLoan && { paymentMethod: { $ne: 'loan' }, isPayLater: { $ne: true } }),
})
    .sort({ createdAt: 1 })
    .populate(populate)

const handle = (build) => async (req, res) => {
    try {
        const { workbook, name } = await build(req)
        return sendWorkbook(res, workbook, name)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.sale = handle(async (req) => {
    const lang = req.query.lang || 'English'
    const { filter, label } = dateRange(req.query)

    const payments = await completedPayments(filter, [
        { path: 'transactions', match: { isDeleted: { $ne: true } }, populate: { path: 'product', select: 'name' } },
        { path: 'customer', select: 'displayName fullName' },
        { path: 'createdBy', select: 'username' },
    ])
    const loanPayments = await LoanPayment.find({ paymentDate: filter, isPaid: true })
        .populate({ path: 'loan', populate: [{ path: 'customer', select: 'displayName fullName' }, { path: 'payment', select: 'invoice rate transactions', populate: { path: 'transactions', select: 'stockCosts' } }] })
        .populate('createdBy', 'username')
    const clearances = await TransactionClearance.find({ createdAt: filter })
        .populate('transaction', 'stockCosts description')
        .populate({ path: 'loan', select: 'payment', populate: { path: 'payment', select: 'invoice rate' } })
        .populate('createdBy', 'username')

    const invoices = []
    const items = []
    payments.forEach((payment) => {
        const buyRate = payment.rate?.buyRate
        const total = toUSD(payment.total?.value, payment.total?.currency, buyRate)
        const cost = (payment.transactions || []).reduce((sum, transaction) => sum + costOf(transaction, buyRate), 0)
        invoices.push({
            date: payment.createdAt,
            invoice: payment.invoice,
            type: 'Sale',
            customer: payment.customer?.displayName || payment.customer?.fullName || '',
            method: (payment.paymentMethod || 'cash').toUpperCase(),
            items: payment.transactions?.length || 0,
            total,
            cost,
            profit: total - cost,
            by: payment.createdBy?.username || '',
        })
        ;(payment.transactions || []).forEach((transaction) => {
            const lineTotal = toUSD(transaction.total?.value, transaction.total?.currency, buyRate)
            const lineCost = costOf(transaction, buyRate)
            const discount = transaction.discount?.value
                ? `${transaction.discount.value}${transaction.discount.type === 'PCT' ? '%' : ` ${transaction.discount.type}`}`
                : ''
            items.push({
                date: payment.createdAt,
                invoice: payment.invoice,
                product: nameOf(transaction.product, lang) || transaction.description || '',
                quantity: transaction.quantity,
                price: transaction.price,
                currency: transaction.currency,
                discount,
                total: lineTotal,
                cost: lineCost,
                profit: lineTotal - lineCost,
            })
        })
    })

    loanPayments.forEach((loanPayment) => {
        const loan = loanPayment.loan
        const buyRate = loan?.payment?.rate?.buyRate
        const total = toUSD(loanPayment.totalAmount?.value, loanPayment.totalAmount?.currency, buyRate)
        // The report spreads the items' cost evenly over the installments
        const itemsCost = (loan?.payment?.transactions || []).reduce((sum, transaction) => sum + costOf(transaction, buyRate), 0)
        const cost = loan?.loanPayments?.length ? itemsCost / loan.loanPayments.length : 0
        invoices.push({
            date: loanPayment.paymentDate,
            invoice: loan?.payment?.invoice || '',
            type: 'Loan installment',
            customer: loan?.customer?.displayName || loan?.customer?.fullName || '',
            method: 'LOAN',
            items: '',
            total,
            cost,
            profit: total - cost,
            by: loanPayment.createdBy?.username || '',
        })
    })

    clearances.forEach((clearance) => {
        const buyRate = clearance.loan?.payment?.rate?.buyRate
        const total = toUSD(clearance.amount, clearance.currency, buyRate)
        const cost = costOf(clearance.transaction, buyRate)
        invoices.push({
            date: clearance.createdAt,
            invoice: clearance.loan?.payment?.invoice || '',
            type: clearance.type === 'REPOSSESSION' ? 'Loan repossession' : 'Loan clearance',
            customer: '',
            method: 'LOAN',
            items: '',
            total,
            cost,
            profit: total - cost,
            by: clearance.createdBy?.username || '',
        })
    })

    // Pay Later: each amount received, on the day it was received
    const payLaterReceived = await installmentsBetween(filter)
    payLaterReceived.forEach((installment) => {
        invoices.push({
            date: installment.paidAt,
            invoice: installment.payment?.invoice || '',
            type: installment.kind === 'DEPOSIT' ? 'Pay Later deposit' : 'Pay Later payment',
            customer: installment.payment?.customer?.displayName || installment.payment?.customer?.fullName || '',
            method: (installment.paymentMethod || 'cash').toUpperCase(),
            items: '',
            total: installment.income,
            cost: installment.cost,
            profit: installment.profit,
            by: installment.createdBy?.username || '',
        })
    })

    invoices.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Revenue per day
    const days = new Map()
    invoices.forEach((row) => {
        const day = moment(row.date).format('YYYY-MM-DD')
        const entry = days.get(day) || { date: day, invoices: 0, income: 0, cost: 0, profit: 0 }
        entry.invoices += 1
        entry.income += row.total
        entry.cost += row.cost
        entry.profit += row.profit
        days.set(day, entry)
    })

    const { USD, DATETIME } = formats
    const workbook = new Workbook()
    addSheet(workbook, 'Revenue', [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Invoices', key: 'invoices', width: 10 },
        { header: 'Income (USD)', key: 'income', width: 16, numFmt: USD },
        { header: 'Cost (USD)', key: 'cost', width: 16, numFmt: USD },
        { header: 'Profit (USD)', key: 'profit', width: 16, numFmt: USD },
    ], Array.from(days.values()), { totals: ['invoices', 'income', 'cost', 'profit'] })
    addSheet(workbook, 'Invoices', [
        { header: 'Date', key: 'date', width: 18, numFmt: DATETIME },
        { header: 'Invoice', key: 'invoice', width: 18 },
        { header: 'Type', key: 'type', width: 18 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Method', key: 'method', width: 11 },
        { header: 'Items', key: 'items', width: 8 },
        { header: 'Total (USD)', key: 'total', width: 14, numFmt: USD },
        { header: 'Cost (USD)', key: 'cost', width: 14, numFmt: USD },
        { header: 'Profit (USD)', key: 'profit', width: 14, numFmt: USD },
        { header: 'By', key: 'by', width: 14 },
    ], invoices, { totals: ['total', 'cost', 'profit'] })
    addSheet(workbook, 'Items', [
        { header: 'Date', key: 'date', width: 18, numFmt: DATETIME },
        { header: 'Invoice', key: 'invoice', width: 18 },
        { header: 'Product', key: 'product', width: 28 },
        { header: 'Qty', key: 'quantity', width: 8 },
        { header: 'Unit Price', key: 'price', width: 12 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Discount', key: 'discount', width: 11 },
        { header: 'Total (USD)', key: 'total', width: 14, numFmt: USD },
        { header: 'Cost (USD)', key: 'cost', width: 14, numFmt: USD },
        { header: 'Profit (USD)', key: 'profit', width: 14, numFmt: USD },
    ], items, { totals: ['quantity', 'total', 'cost', 'profit'] })

    return { workbook, name: `sale-report_${label}.xlsx` }
})

// Totals per product (or per staff) from completed sales in the range
const groupTransactions = async (filter, keyOf, populate) => {
    const payments = await completedPayments(filter, { path: 'transactions', match: { isDeleted: { $ne: true } }, populate }, { includeLoan: true })
    const groups = new Map()
    payments.forEach((payment) => {
        const buyRate = payment.rate?.buyRate
        ;(payment.transactions || []).forEach((transaction) => {
            const key = keyOf(transaction)
            if (!key) return
            const entry = groups.get(key.id) || { ...key, invoices: new Set(), quantity: 0, total: 0, cost: 0 }
            entry.invoices.add(String(payment._id))
            entry.quantity += Number(transaction.quantity) || 0
            entry.total += toUSD(transaction.total?.value, transaction.total?.currency, buyRate)
            entry.cost += costOf(transaction, buyRate)
            groups.set(key.id, entry)
        })
    })
    return Array.from(groups.values())
        .map(({ invoices, ...entry }) => ({ ...entry, invoices: invoices.size, profit: entry.total - entry.cost }))
        .sort((a, b) => b.total - a.total)
}

exports.product = handle(async (req) => {
    const lang = req.query.lang || 'English'
    const { filter, label } = dateRange(req.query)
    const rows = await groupTransactions(filter, (transaction) => transaction.product && {
        id: String(transaction.product._id),
        name: nameOf(transaction.product, lang),
        code: transaction.product.code || '',
    }, { path: 'product', select: 'name code' })

    const { USD } = formats
    const workbook = new Workbook()
    addSheet(workbook, 'Products', [
        { header: 'Product', key: 'name', width: 30 },
        { header: 'Code', key: 'code', width: 14 },
        { header: 'Invoices', key: 'invoices', width: 10 },
        { header: 'Qty Sold', key: 'quantity', width: 10 },
        { header: 'Sales (USD)', key: 'total', width: 15, numFmt: USD },
        { header: 'Cost (USD)', key: 'cost', width: 15, numFmt: USD },
        { header: 'Profit (USD)', key: 'profit', width: 15, numFmt: USD },
    ], rows, { totals: ['quantity', 'total', 'cost', 'profit'] })
    return { workbook, name: `product-report_${label}.xlsx` }
})

exports.staff = handle(async (req) => {
    const { filter, label } = dateRange(req.query)
    const rows = await groupTransactions(filter, (transaction) => transaction.createdBy && {
        id: String(transaction.createdBy._id),
        name: transaction.createdBy.username,
    }, { path: 'createdBy', select: 'username' })

    const { USD } = formats
    const workbook = new Workbook()
    addSheet(workbook, 'Staff', [
        { header: 'Staff', key: 'name', width: 22 },
        { header: 'Invoices', key: 'invoices', width: 10 },
        { header: 'Items Sold', key: 'quantity', width: 11 },
        { header: 'Sales (USD)', key: 'total', width: 15, numFmt: USD },
        { header: 'Cost (USD)', key: 'cost', width: 15, numFmt: USD },
        { header: 'Profit (USD)', key: 'profit', width: 15, numFmt: USD },
    ], rows, { totals: ['invoices', 'quantity', 'total', 'cost', 'profit'] })
    return { workbook, name: `staff-report_${label}.xlsx` }
})

// Stock on hand. Cost columns are only included for roles with product.viewCost.
exports.inventory = handle(async (req) => {
    const lang = req.query.lang || 'English'
    const showCost = canViewCost(req.user)
    const buyRate = req.user?.drawer?.buyRate || 4000

    const products = await Product.find({ isDeleted: false, isStock: true })
        .select('name code price currency category brand')
        .populate('category', 'name')
        .populate('brand', 'name')
        .sort({ createdAt: 1 })
        .lean()
    const stocks = await ProductStock.find({ isDeleted: { $ne: true }, quantity: { $gt: 0 }, product: { $in: products.map((product) => product._id) } })
        .sort({ _id: 1 })
        .populate({ path: 'color', model: ProductColor, select: 'name' })
        .populate({ path: 'options', model: ProductOption, select: 'name' })
        .lean()

    const byProduct = new Map()
    stocks.forEach((stock) => {
        const list = byProduct.get(String(stock.product)) || []
        list.push(stock)
        byProduct.set(String(stock.product), list)
    })

    const productRows = products.map((product) => {
        const batches = byProduct.get(String(product._id)) || []
        const quantity = batches.reduce((sum, stock) => sum + stock.quantity, 0)
        const costValue = batches.reduce((sum, stock) => sum + toUSD(stock.cost * stock.quantity, stock.currency, buyRate), 0)
        const retailValue = toUSD(product.price, product.currency, buyRate) * quantity
        const nearestExpiry = batches.map((stock) => stock.expireAt).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0]
        return {
            name: nameOf(product, lang),
            code: product.code || '',
            category: nameOf(product.category, lang),
            brand: nameOf(product.brand, lang),
            price: Number(product.price) || 0,
            currency: product.currency,
            quantity,
            batches: batches.length,
            ...(showCost && { costValue, retailValue, margin: retailValue - costValue }),
            expireAt: nearestExpiry ? moment(nearestExpiry).format('YYYY-MM-DD') : '',
        }
    })

    const productNames = new Map(products.map((product) => [String(product._id), nameOf(product, lang)]))
    const batchRows = stocks.map((stock) => ({
        product: productNames.get(String(stock.product)) || '',
        code: stock.code || '',
        variant: [nameOf(stock.color, lang), ...(stock.options || []).map((option) => nameOf(option, lang))].filter(Boolean).join(', '),
        quantity: stock.quantity,
        ...(showCost && { cost: stock.cost, currency: stock.currency, value: toUSD(stock.cost * stock.quantity, stock.currency, buyRate) }),
        expireAt: stock.expireAt ? moment(stock.expireAt).format('YYYY-MM-DD') : '',
        createdAt: stock.createdAt,
    }))

    const { USD, DATETIME } = formats
    const costColumns = (columns) => showCost ? columns : []
    const workbook = new Workbook()
    addSheet(workbook, 'Products', [
        { header: 'Product', key: 'name', width: 30 },
        { header: 'Code', key: 'code', width: 14 },
        { header: 'Category', key: 'category', width: 16 },
        { header: 'Brand', key: 'brand', width: 16 },
        { header: 'Price', key: 'price', width: 11 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'In Stock', key: 'quantity', width: 10 },
        { header: 'Batches', key: 'batches', width: 9 },
        ...costColumns([
            { header: 'Cost Value (USD)', key: 'costValue', width: 17, numFmt: USD },
            { header: 'Retail Value (USD)', key: 'retailValue', width: 18, numFmt: USD },
            { header: 'Margin (USD)', key: 'margin', width: 15, numFmt: USD },
        ]),
        { header: 'Nearest Expiry', key: 'expireAt', width: 15 },
    ], productRows, { totals: ['quantity', 'batches', 'costValue', 'retailValue', 'margin'] })
    addSheet(workbook, 'Batches', [
        { header: 'Product', key: 'product', width: 30 },
        { header: 'Batch Code', key: 'code', width: 14 },
        { header: 'Variant', key: 'variant', width: 18 },
        { header: 'In Stock', key: 'quantity', width: 10 },
        ...costColumns([
            { header: 'Unit Cost', key: 'cost', width: 11 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Value (USD)', key: 'value', width: 14, numFmt: USD },
        ]),
        { header: 'Expire At', key: 'expireAt', width: 13 },
        { header: 'Added At', key: 'createdAt', width: 18, numFmt: DATETIME },
    ], batchRows, { totals: ['quantity', 'value'] })

    return { workbook, name: `inventory_${moment().format('YYYY-MM-DD')}.xlsx` }
})
