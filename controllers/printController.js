const response = require('../helpers/response')
const qzTray = require('../helpers/qzTray')
const { buildLabels, buildReceipt, buildGroupReceipts } = require('../helpers/printTemplates')
const StoreSetting = require('../models/StoreSetting')

const getSetting = async () => (await StoreSetting.findOne()) || new StoreSetting()

// Receipts go to the customer receipt printer by default; `store` is the
// narrow kitchen/store copy printer.
const getReceiptPrinter = (setting, target) => target === 'store'
    ? { printer: setting.storePrinterName, charsPerLine: setting.storePrinterCharPerLine || 32 }
    : { printer: setting.receiptPrinterName, charsPerLine: setting.receiptPrinterCharPerLine || 48 }

const handlePrintError = (err, res) => response.failure(422, { msg: `Printing failed: ${err?.message || err}` }, res, err)

// In `api` mode the API prints through QZ Tray on its host. In `web` mode the
// built jobs are returned and the browser prints them through its own QZ Tray,
// so both modes share the same templates.
const dispatch = async (setting, printer, jobs, options, msg, res) => {
    // A printer left blank in the settings is skipped, e.g. a store without a store copy printer
    if (!printer || !jobs.length) return response.success(200, { msg: 'Nothing to print', data: { mode: 'skipped' } }, res)
    if (setting.printMode === 'web') {
        return response.success(200, { msg, data: { mode: 'web', printer, jobs, options } }, res)
    }
    await qzTray.print(printer, jobs, options)
    return response.success(200, { msg, data: { mode: 'api' } }, res)
}

exports.status = async (req, res) => {
    try {
        return response.success(200, { data: await qzTray.status() }, res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}

exports.certificate = async (req, res) => {
    try {
        return response.success(200, { data: { certificate: qzTray.getCertificate() } }, res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}

exports.sign = async (req, res) => {
    try {
        if (!req.body.data) return response.failure(422, { msg: 'Missing data to sign' }, res)
        return response.success(200, { data: { signature: qzTray.sign(req.body.data) } }, res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}

exports.label = async (req, res) => {
    try {
        const setting = await getSetting()
        const jobs = buildLabels(req.body.data || {}, {
            width: Number(setting.thermalPrinterWidth) || 52,
            height: Number(setting.thermalPrinterHeight) || 126,
            gap: Number(setting.thermalPrinterGap) || 2,
        })
        return await dispatch(setting, setting.thermalPrinterName, jobs, {}, `Printed ${jobs.length} label(s)`, res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}

exports.receipt = async (req, res) => {
    try {
        const setting = await getSetting()
        const { printer, charsPerLine } = getReceiptPrinter(setting, req.body.target)
        return await dispatch(setting, printer, buildReceipt(req.body.data || {}, charsPerLine), { encoding: 'UTF-8' }, 'Receipt printed', res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}

exports.groupReceipt = async (req, res) => {
    try {
        const setting = await getSetting()
        const { printer, charsPerLine } = getReceiptPrinter(setting, req.body.target)
        return await dispatch(setting, printer, buildGroupReceipts(req.body.data || [], req.body.payment || {}, charsPerLine), { encoding: 'UTF-8' }, 'Receipt printed', res)
    } catch (err) {
        return handlePrintError(err, res)
    }
}
