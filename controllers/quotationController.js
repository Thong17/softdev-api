const Quotation = require('../models/Quotation')
const Customer = require('../models/Customer')
const Store = require('../models/Store')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, calculatePaymentTotal, generateInvoice } = require('../helpers/utils')
const { quotationValidation } = require('../middleware/validations/quotationValidation')
const { Workbook } = require('exceljs')
const { worksheetOption } = require('../configs/excel')
const moment = require('moment')

const populateQuotation = (query) => query
    .populate('customer', 'displayName fullName contact address')
    .populate('createdBy', 'username')

// A quotation does not need an open drawer, so fall back to the rate sent by
// the client and then to the default rate used elsewhere in the app.
const getRate = (req, body) => ({
    buyRate: req.user.drawer?.buyRate || body.rate?.buyRate || 4000,
    sellRate: req.user.drawer?.sellRate || body.rate?.sellRate || 4000,
})

const mapQuotationBody = (req, body) => {
    const rate = getRate(req, body)
    const discounts = body.discounts || []
    const services = body.services || []
    const vouchers = body.vouchers || []
    const { total, subtotal } = calculatePaymentTotal(body.items, services, vouchers, discounts, rate)

    return {
        customer: body.customer || null,
        items: body.items.map(item => ({ ...item, product: item.product || null })),
        discounts,
        services,
        vouchers,
        note: body.note,
        total,
        subtotal,
        rate,
    }
}

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.trim()
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'desc'

    try {
        let query = { isDeleted: false }
        if (search) {
            const customers = await Customer.find({ displayName: { $regex: new RegExp(search, 'i') } }).select('_id')
            query.$or = [
                { invoice: { $regex: new RegExp(search, 'i') } },
                { customer: { $in: customers.map(customer => customer._id) } },
            ]
        }

        const quotations = await populateQuotation(Quotation.find(query))
            .skip(page * limit).limit(limit)
            .sort({ [filter]: sort })
        const totalCount = await Quotation.count(query)
        return response.success(200, { data: quotations, length: totalCount }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    try {
        const quotation = await populateQuotation(Quotation.findOne({ _id: req.params.id, isDeleted: false }))
        if (!quotation) return response.failure(404, { msg: 'Quotation not found' }, res)
        return response.success(200, { data: quotation }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = quotationValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const invoice = await generateInvoice(Quotation, new Date(), process.env.QUOTATION_PREFIX || 'QUO')
        const created = await Quotation.create({ ...mapQuotationBody(req, body), invoice, createdBy: req.user.id })
        const quotation = await populateQuotation(Quotation.findById(created._id))
        return response.success(200, { msg: 'Quotation has created successfully', data: quotation }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = quotationValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const updated = await Quotation.findOneAndUpdate(
            { _id: req.params.id, isDeleted: false },
            { ...mapQuotationBody(req, body), updatedBy: req.user.id }
        )
        if (!updated) return response.failure(404, { msg: 'Quotation not found' }, res)
        const quotation = await populateQuotation(Quotation.findById(req.params.id))
        return response.success(200, { msg: 'Quotation has updated successfully', data: quotation }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._delete = async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndUpdate(req.params.id, { isDeleted: true, updatedBy: req.user.id })
        if (!quotation) return response.failure(404, { msg: 'Quotation not found' }, res)
        return response.success(200, { msg: 'Quotation has deleted successfully', data: quotation }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

const formatAmount = (value, currency) => currency === 'KHR'
    ? `${Math.round(value || 0).toLocaleString('en-US')} ៛`
    : `$${(value || 0).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`

const formatPromotion = (promotion) => {
    if (!promotion?.value) return ''
    return promotion.type === 'PCT' ? `${promotion.value}%` : formatAmount(promotion.value, promotion.type)
}

exports._export = async (req, res) => {
    try {
        const quotation = await populateQuotation(Quotation.findOne({ _id: req.params.id, isDeleted: false }))
        if (!quotation) return response.failure(404, { msg: 'Quotation not found' }, res)
        const store = await Store.findOne()
        const lang = req.body.lang || 'English'

        const workbook = new Workbook()
        const worksheet = workbook.addWorksheet('QUOTATION', { ...worksheetOption, pageSetup: { ...worksheetOption.pageSetup, orientation: 'portrait' } })
        worksheet.columns = [
            { key: 'no', width: 6, style: { alignment: { vertical: 'middle', horizontal: 'center' } } },
            { key: 'description', width: 45 },
            { key: 'quantity', width: 10, style: { alignment: { horizontal: 'center' } } },
            { key: 'price', width: 16, style: { alignment: { horizontal: 'right' } } },
            { key: 'discount', width: 12, style: { alignment: { horizontal: 'center' } } },
            { key: 'total', width: 18, style: { alignment: { horizontal: 'right' } } },
        ]

        // Header
        const titleRow = worksheet.addRow([store?.name?.[lang] || store?.name?.English || store?.name || ''])
        worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`)
        titleRow.font = { bold: true, size: 16 }
        if (store?.address) worksheet.addRow([store.address])
        if (store?.contact) worksheet.addRow([store.contact])
        worksheet.addRow([])

        const headingRow = worksheet.addRow(['QUOTATION'])
        worksheet.mergeCells(`A${headingRow.number}:F${headingRow.number}`)
        headingRow.font = { bold: true, size: 14 }
        headingRow.alignment = { horizontal: 'center' }

        worksheet.addRow(['No.', quotation.invoice])
        worksheet.addRow(['Date', moment(quotation.createdAt).format('YYYY-MM-DD HH:mm')])
        worksheet.addRow(['Customer', quotation.customer?.displayName || quotation.customer?.fullName || '-'])
        if (quotation.customer?.contact) worksheet.addRow(['Contact', quotation.customer.contact])
        worksheet.addRow([])

        // Items
        const itemHeader = worksheet.addRow(['No', 'Description', 'Qty', 'Price', 'Discount', 'Total'])
        itemHeader.font = { bold: true }
        itemHeader.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
            cell.border = { bottom: { style: 'thin' } }
        })
        quotation.items.forEach((item, index) => {
            worksheet.addRow({
                no: index + 1,
                description: item.description,
                quantity: item.quantity,
                price: formatAmount(item.price, item.currency),
                discount: formatPromotion(item.discount),
                total: formatAmount(item.total?.value, item.total?.currency),
            })
        })
        worksheet.addRow([])

        // Summary
        const addSummary = (label, value, bold = false) => {
            const row = worksheet.addRow({ discount: label, total: value })
            if (bold) row.font = { bold: true }
        }
        addSummary('Subtotal', formatAmount(quotation.subtotal?.BOTH, 'USD'))
        quotation.discounts?.forEach(discount => discount?.value && addSummary('Discount', `-${formatPromotion(discount)}`))
        quotation.services?.forEach(service => service?.value && addSummary('Tax', `+${formatPromotion(service)}`))
        quotation.vouchers?.forEach(voucher => voucher?.value && addSummary('Voucher', `-${formatPromotion(voucher)}`))
        addSummary('Total', formatAmount(quotation.total?.value, quotation.total?.currency), true)

        if (quotation.note) {
            worksheet.addRow([])
            worksheet.addRow(['Note', quotation.note])
        }

        const name = `${quotation.invoice}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=${name}`)

        const file = await workbook.xlsx.writeBuffer()
        return response.success(200, { file, name }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
