// Builds raw printer commands (TSPL for labels, ESC/POS for receipts).
// Each builder returns an array of jobs; each job is sent as its own print.

const init = '\x1B@'
const alignCenter = '\x1Ba\x01'
const alignLeft = '\x1Ba\x00'
const boldOn = '\x1BE\x01'
const boldOff = '\x1BE\x00'
const doubleSize = '\x1D!\x11'
const normalSize = '\x1D!\x00'
const cut = '\x1DV\x00'
const drawerPulse = '\x1Bp\x00\x3C\xFF'
const newLine = '\n'

const sanitize = (value = '') => (value ?? '').toString().replace(/"/g, "'")

const parseNumeric = (value) => {
    if (!value) return 0
    const numeric = Number.parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return Number.isNaN(numeric) ? 0 : numeric
}

const shouldShowTotalLine = (value) => parseNumeric(value) !== 0

const pad = (text, width, align = 'left') => {
    const safe = text.length > width ? text.slice(0, width - 1) + '…' : text
    return align === 'right'
        ? ' '.repeat(Math.max(0, width - safe.length)) + safe
        : safe + ' '.repeat(Math.max(0, width - safe.length))
}

const wrapText = (text, width) => {
    const words = text.split(' ')
    const lines = []
    let line = ''

    for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (next.length <= width) {
            line = next
        } else {
            if (line) lines.push(line)
            line = word
        }
    }

    if (line) lines.push(line)
    return lines.length ? lines : ['']
}

const getColumnWidths = (lineWidth) => {
    const qtyWidth = 4
    const minPrice = 8
    const minDisc = 8
    const minTotal = 8
    const minItem = 12

    let priceWidth = Math.max(minPrice, Math.floor(lineWidth * 0.18))
    let discWidth = Math.max(minDisc, Math.floor(lineWidth * 0.18))
    let totalWidth = Math.max(minTotal, Math.floor(lineWidth * 0.18))
    let itemWidth = lineWidth - qtyWidth - priceWidth - discWidth - totalWidth

    if (itemWidth < minItem) {
        priceWidth = minPrice
        discWidth = minDisc
        totalWidth = minTotal
        itemWidth = lineWidth - qtyWidth - priceWidth - discWidth - totalWidth
    }

    if (itemWidth < minItem) {
        itemWidth = Math.max(8, itemWidth)
        const extra = minItem - itemWidth
        const reduceFrom = [priceWidth - minPrice, discWidth - minDisc, totalWidth - minTotal].reduce((sum, v) => sum + Math.max(0, v), 0)
        if (reduceFrom > 0) {
            const ratio = extra / reduceFrom
            priceWidth = Math.max(minPrice, priceWidth - Math.round((priceWidth - minPrice) * ratio))
            discWidth = Math.max(minDisc, discWidth - Math.round((discWidth - minDisc) * ratio))
            totalWidth = Math.max(minTotal, totalWidth - Math.round((totalWidth - minTotal) * ratio))
            itemWidth = lineWidth - qtyWidth - priceWidth - discWidth - totalWidth
        }
    }

    if (itemWidth < 1) {
        itemWidth = 1
        priceWidth = Math.max(minPrice, lineWidth - qtyWidth - discWidth - totalWidth - itemWidth)
    }

    return { itemWidth, qtyWidth, priceWidth, discWidth, totalWidth }
}

exports.buildLabels = (data, { width = 52, height = 126, gap = 2 } = {}) => {
    const jobs = []
    for (const item of data.items || []) {
        if (!item.hasThermalPrinting) continue
        // sanitize description to avoid breaking TSPL string quoting
        const desc = sanitize(item.description || '')
        const optionsText = (item.options || []).slice(0, 3).map((option, index) => `\n            TEXT 70,${110 + index * 30},"2",0,1,1,"- ${sanitize(option.name)}: ${sanitize(option.value)}"\r\n\n            `)
        const label = [
            `SIZE ${width} mm, ${height} mm\r\n`,
            `GAP ${gap} mm, 0 mm\r\n`,
            'DENSITY 1\r\n',
            'CLS\r\n',
            `TEXT 50,20,"2",0,1,1,"${sanitize(data.createdAt || '')}"\r\n`,
            `TEXT 50,50,"2",0,1,1,"Queue: #${sanitize(data.invoice?.split('-')[1] || '')}"\r\n`,
            `TEXT 50,80,"2",0,1,1,"${desc}"\r\n`,
            ...optionsText,
            'PRINT 1,1\r\n',
        ].join('')

        for (let i = 0; i < (item.qty || 0); i++) jobs.push(label)
    }
    return jobs
}

exports.buildReceipt = (data, charsPerLine = 48) => {
    const { itemWidth, qtyWidth, priceWidth, discWidth, totalWidth } = getColumnWidths(charsPerLine)
    const lineSep = '-'.repeat(charsPerLine)

    const headerParts = [
        init,
        alignCenter,
        boldOn,
        doubleSize,
        `${sanitize(data.name || '')}`,
        newLine,
        `#${sanitize(data.invoice?.split('-')[1] || '')}`,
        boldOff,
        normalSize,
        newLine,
    ]

    const addressParts = data.address
        ? [alignCenter, `${sanitize(data.address)}`, newLine]
        : []

    const transactionLines = charsPerLine > 40 ? [
        alignLeft,
        lineSep,
        newLine,
        `Invoice: ${sanitize(data.invoice || '')}`,
        newLine,
        `Cashier: ${sanitize(data.cashier || '')}`,
        ...((data.table && data.table !== '--') ? [newLine, `Table: ${sanitize(data.table || '--')}`] : []),
        newLine,
        `Date: ${sanitize(data.createdAt || '')}`,
        newLine,
        `Payment Method: ${sanitize(data.paymentMethod || '')}`,
        newLine,
        lineSep,
        newLine,
        pad('Item', itemWidth),
        pad('Qty', qtyWidth, 'right'),
        pad('Price', priceWidth, 'right'),
        pad('Disc', discWidth, 'right'),
        pad('Total', totalWidth, 'right'),
        newLine,
        lineSep,
        newLine,
        ...(data.transactions || []).flatMap((item) => {
            const wrappedName = wrapText(sanitize(item.item || ''), itemWidth)
            const rows = [
                pad(wrappedName[0], itemWidth),
                pad((item.qty || 0).toString(), qtyWidth, 'right'),
                pad(sanitize(item.price || ''), priceWidth, 'right'),
                pad(sanitize(item.disc || ''), discWidth, 'right'),
                pad(sanitize(item.total || ''), totalWidth, 'right'),
                newLine,
            ]

            for (let i = 1; i < wrappedName.length; i += 1) {
                rows.push(
                    pad(wrappedName[i], itemWidth),
                    pad('', qtyWidth, 'right'),
                    pad('', priceWidth, 'right'),
                    pad('', discWidth, 'right'),
                    pad('', totalWidth, 'right'),
                    newLine,
                )
            }

            // print options under the item, one per line with a dash prefix
            for (const opt of (item.options || [])) {
                rows.push(
                    pad(`- ${sanitize(opt.name)}: ${sanitize(opt.value)}`, itemWidth),
                    pad('', qtyWidth, 'right'),
                    pad('', priceWidth, 'right'),
                    pad('', discWidth, 'right'),
                    pad('', totalWidth, 'right'),
                    newLine,
                )
            }

            return rows
        }),
        lineSep,
        newLine,
    ] : [
        alignLeft,
        `Invoice: ${sanitize(data.invoice || '')}`,
        newLine,
        `Cashier: ${sanitize(data.cashier || '')}`,
        newLine,
        `Date: ${sanitize(data.createdAt || '')}`,
        newLine,
        lineSep,
        newLine,
        pad('Item', itemWidth + priceWidth + 4),
        pad('Qty', qtyWidth, 'right'),
        pad('Total', totalWidth, 'right'),
        newLine,
        lineSep,
        newLine,
        ...(data.transactions || []).flatMap((item) => {
            const wrappedName = wrapText(sanitize(item.item || ''), itemWidth + priceWidth + 4)
            const rows = [
                pad(wrappedName[0], itemWidth + priceWidth + 4),
                pad((item.qty || 0).toString(), qtyWidth, 'right'),
                pad(sanitize(item.total || ''), totalWidth, 'right'),
                newLine,
            ]

            for (let i = 1; i < wrappedName.length; i += 1) {
                rows.push(
                    pad(wrappedName[i], itemWidth + priceWidth + 4),
                    pad('', qtyWidth, 'right'),
                    pad('', totalWidth, 'right'),
                    newLine,
                )
            }

            // print options for narrow layout under the item
            for (const opt of (item.options || [])) {
                rows.push(
                    pad(`- ${sanitize(opt.name)}: ${sanitize(opt.value)}`, itemWidth + priceWidth + 4),
                    pad('', qtyWidth, 'right'),
                    pad('', totalWidth, 'right'),
                    newLine,
                )
            }

            return rows
        }),
        lineSep,
        newLine,
    ]

    const totalLines = ['Subtotal', 'Discount', 'Tax', 'Total'].flatMap((label) => {
        const value = data[label.toLowerCase()]
        if (!shouldShowTotalLine(value)) return []

        const labelWidth = Math.max(12, charsPerLine - 20)
        const valueWidth = charsPerLine - labelWidth
        return [
            pad(`${label}:`, labelWidth),
            pad(sanitize(value || ''), valueWidth, 'right'),
            newLine,
        ]
    })

    const footerParts = data.footer
        ? [newLine, newLine, alignCenter, `${sanitize(data.footer)}`, newLine, newLine]
        : [newLine, newLine]

    const receipt = charsPerLine > 40 ? [
        ...headerParts,
        ...addressParts,
        ...transactionLines,
        ...totalLines,
        ...footerParts,
        ...(data.paymentMethod === 'cash' ? [drawerPulse] : []),
        newLine.repeat(3),
        cut,
    ] : [
        ...transactionLines,
        ...totalLines,
        newLine.repeat(3),
        ...(data.paymentMethod === 'cash' ? [drawerPulse] : []),
        newLine.repeat(3),
        cut,
    ]

    return [receipt.join('')]
}

exports.buildGroupReceipts = (data, payment, charsPerLine = 48) => {
    // group receipts by payment method
    const groups = {}
    for (const r of data || []) {
        const key = (r.paymentMethod || 'unknown').toString()
        groups[key] = groups[key] || []
        groups[key].push(r)
    }

    const lineSep = '-'.repeat(charsPerLine)
    const labelWidth = Math.max(12, charsPerLine - 20)
    const valueWidth = charsPerLine - labelWidth
    const jobs = []

    for (const [paymentMethod, receipts] of Object.entries(groups)) {
        const headerParts = [init, alignCenter, boldOn, doubleSize, sanitize(paymentMethod || ''), newLine, boldOff, normalSize, newLine]
        const transactionLines = []

        transactionLines.push(alignLeft, lineSep, newLine)
        transactionLines.push(`Invoice: ${sanitize(payment.invoice || '')}`, newLine)
        transactionLines.push(`Cashier: ${sanitize(payment.cashier || '')}`, newLine)
        if (payment.table && payment.table !== '--') transactionLines.push(`Table: ${sanitize(payment.table)}`, newLine)
        transactionLines.push(`Date: ${sanitize(payment.createdAt || '')}`, newLine)
        transactionLines.push(`Payment Method: ${sanitize(payment.paymentMethod || '')}`, newLine)

        for (const r of receipts) {
            transactionLines.push(lineSep, newLine)
            const invoicePrefix = ` #${sanitize(r.invoice?.split('-')[1] || '')}`
            if (charsPerLine > 40) {
                const itemWidth = Math.floor(charsPerLine * 0.5)
                const priceW = Math.floor(charsPerLine * 0.18)
                transactionLines.push(pad('Invoice' + invoicePrefix, itemWidth), pad('Qty', 4, 'right'), pad('Price', priceW, 'right'), pad('Disc', priceW, 'right'), pad('Total', priceW, 'right'), newLine)
                transactionLines.push(lineSep, newLine)

                for (const t of r.transactions || []) {
                    const wrapped = wrapText(`${sanitize(t.item || '')}`, itemWidth)
                    transactionLines.push(pad(wrapped[0], itemWidth), pad((t.qty || 0).toString(), 4, 'right'), pad(sanitize(t.price || ''), priceW, 'right'), pad(sanitize(t.disc || ''), priceW, 'right'), pad(sanitize(t.total || ''), priceW, 'right'), newLine)
                    for (let i = 1; i < wrapped.length; i++) transactionLines.push(pad(wrapped[i], itemWidth), pad('', 4, 'right'), pad('', priceW, 'right'), pad('', priceW, 'right'), pad('', priceW, 'right'), newLine)
                    for (const opt of (t.options || [])) {
                        transactionLines.push(pad(`- ${sanitize(opt.name)}: ${sanitize(opt.value)}`, itemWidth), pad('', 4, 'right'), pad('', priceW, 'right'), pad('', priceW, 'right'), pad('', priceW, 'right'), newLine)
                    }
                }
            } else {
                const nameW = Math.floor(charsPerLine * 0.6)
                const totalW = Math.floor(charsPerLine * 0.3)
                transactionLines.push(pad('Invoice' + invoicePrefix, nameW), pad('Qty', 4, 'right'), pad('Total', totalW, 'right'), newLine)
                transactionLines.push(lineSep, newLine)

                for (const t of r.transactions || []) {
                    const wrapped = wrapText(`${sanitize(t.item || '')}`, nameW)
                    transactionLines.push(pad(wrapped[0], nameW), pad((t.qty || 0).toString(), 4, 'right'), pad(sanitize(t.total || ''), totalW, 'right'), newLine)
                    for (let i = 1; i < wrapped.length; i++) transactionLines.push(pad(wrapped[i], nameW), pad('', 4, 'right'), pad('', totalW, 'right'), newLine)
                    for (const opt of (t.options || [])) {
                        transactionLines.push(pad(`- ${sanitize(opt.name)}: ${sanitize(opt.value)}`, nameW), pad('', 4, 'right'), pad('', totalW, 'right'), newLine)
                    }
                }
            }

            transactionLines.push(lineSep, newLine)
            transactionLines.push(pad('Subtotal:', labelWidth), pad(sanitize(r.subtotal || ''), valueWidth, 'right'), newLine)

            if (shouldShowTotalLine(r.discount)) {
                transactionLines.push(pad('Discount:', labelWidth), pad(sanitize(r.discount || ''), valueWidth, 'right'), newLine)
            }

            if (shouldShowTotalLine(r.tax)) {
                transactionLines.push(pad('Tax:', labelWidth), pad(sanitize(r.tax || ''), valueWidth, 'right'), newLine)
            }

            if (shouldShowTotalLine(r.voucher)) {
                transactionLines.push(pad('Voucher:', labelWidth), pad(sanitize(r.voucher || ''), valueWidth, 'right'), newLine)
            }

            transactionLines.push(pad('Total:', labelWidth), pad(sanitize(r.total || ''), valueWidth, 'right'), newLine)
            transactionLines.push(newLine)
        }

        transactionLines.push(lineSep, newLine)
        transactionLines.push(pad('Grand Total:', labelWidth), pad(sanitize(payment.total || ''), valueWidth, 'right'), newLine)
        transactionLines.push(newLine)

        const footerParts = [newLine, newLine]
        jobs.push([...headerParts, ...transactionLines, ...footerParts, ...(paymentMethod === 'cash' ? [drawerPulse] : []), newLine.repeat(3), cut].join(''))
    }

    return jobs
}
