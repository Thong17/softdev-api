const { Workbook } = require('exceljs')
const { worksheetOption } = require('../configs/excel')
const response = require('./response')

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } }

// Adds a sheet with a bold dark header row, the given column widths and number
// formats, and optional total row. `columns`: [{ header, key, width, numFmt }]
const addSheet = (workbook, name, columns, rows, { totals } = {}) => {
    const worksheet = workbook.addWorksheet(name, worksheetOption)
    worksheet.columns = columns.map(({ header, key, width, numFmt }) => ({
        header,
        key,
        width: width || 15,
        style: numFmt ? { numFmt } : undefined,
    }))
    const header = worksheet.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = HEADER_FILL
    header.alignment = { vertical: 'middle' }
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    rows.forEach((row) => worksheet.addRow(row))

    if (totals && rows.length) {
        const total = {}
        columns.forEach(({ key }, index) => {
            if (index === 0) total[key] = 'Total'
            else if (totals.includes(key)) total[key] = rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
        })
        const totalRow = worksheet.addRow(total)
        totalRow.font = { bold: true }
        totalRow.border = { top: { style: 'thin' } }
    }
    return worksheet
}

// Sends the workbook the same way as the other exports: { file, name } JSON,
// which the web app turns back into a download
const sendWorkbook = async (res, workbook, name) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${name}`)
    const file = await workbook.xlsx.writeBuffer()
    return response.success(200, { file, name }, res)
}

const USD = '"$"#,##0.00'
const KHR = '#,##0"៛"'
const DATE = 'yyyy-mm-dd'
const DATETIME = 'yyyy-mm-dd hh:mm'

module.exports = { Workbook, addSheet, sendWorkbook, formats: { USD, KHR, DATE, DATETIME } }
