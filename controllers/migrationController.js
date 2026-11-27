// Admin › Migration: import products from Excel by name (brand and category
// matched, or created, by English name), attach images in bulk by file name,
// and add stock batches from Excel (product matched by barcode or name).
const path = require('path')
const crypto = require('crypto')
const xlsx = require('xlsx')
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const Image = require('../models/Image')
const Icon = require('../models/Icon')
const ProductStock = require('../models/ProductStock')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { Workbook, addSheet, sendWorkbook } = require('../helpers/excel')
const { minioClient } = require('../configs/multer')
const { createProductRecord } = require('./productController')
const { applyNewPrice, canChangePrice } = require('./stockController')
const { withFallbackProfile } = require('../helpers/productImage')

// The one rule for matching names: trim, single spaces, ignore case
const nameKey = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const text = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

// Template columns, in order. Headers are read case-insensitively, and spaces
// or dashes count as underscores ("Product Name EN" works too).
const COLUMNS = [
    { header: 'PRODUCT_NAME_EN', key: 'productNameEn', width: 32 },
    { header: 'PRODUCT_NAME_KH', key: 'productNameKh', width: 32 },
    { header: 'BRAND_NAME_EN', key: 'brandNameEn', width: 22 },
    { header: 'BRAND_NAME_KH', key: 'brandNameKh', width: 22 },
    { header: 'CATEGORY_NAME_EN', key: 'categoryNameEn', width: 22 },
    { header: 'CATEGORY_NAME_KH', key: 'categoryNameKh', width: 22 },
    { header: 'PRICE', key: 'price', width: 10 },
    { header: 'CURRENCY', key: 'currency', width: 10 },
    { header: 'IS_STOCK', key: 'isStock', width: 10 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'BARCODE', key: 'barcode', width: 18 },
    { header: 'DESCRIPTION', key: 'description', width: 40 },
]
const headerKey = (header) => String(header ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')

// TRUE/FALSE, yes/no, y/n, 1/0 (any case); empty gives the default;
// anything else is undefined (an error)
const parseBool = (value, fallback) => {
    if (value === undefined || value === null || text(value) === '') return fallback
    if (typeof value === 'boolean') return value
    const word = text(value).toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(word)) return true
    if (['false', 'no', 'n', '0'].includes(word)) return false
    return undefined
}

// Brands or categories by English name; a name used by 2+ records counts as
// unclear and links to none of them
const indexByName = (records) => {
    const index = new Map()
    records.forEach((record) => {
        const key = nameKey(record.name?.English)
        if (!key) return
        const list = index.get(key) || []
        list.push(record)
        index.set(key, list)
    })
    return index
}

// Checks every row against the database and against earlier rows. Shared by
// preview and import, so the server enforces exactly what the preview shows.
const validateRows = async (rows) => {
    const [products, brands, categories] = await Promise.all([
        Product.find({ isDeleted: { $ne: true } }).select('name code').lean(),
        Brand.find({ isDeleted: { $ne: true } }).select('name').lean(),
        Category.find({ isDeleted: { $ne: true } }).select('name').lean(),
    ])
    const productNames = new Set(products.map((product) => nameKey(product.name?.English)).filter(Boolean))
    const productCodes = new Map(products.filter((product) => text(product.code)).map((product) => [text(product.code), product.name?.English]))
    const brandIndex = indexByName(brands)
    const categoryIndex = indexByName(categories)
    const seenNames = new Map()

    const linkTo = (index, nameEn, label) => {
        const key = nameKey(nameEn)
        if (!key) return { status: 'none' }
        const found = index.get(key)
        if (!found) return { status: 'new', name: text(nameEn) }
        if (found.length > 1) return { status: 'unclear', name: text(nameEn), error: `${found.length} ${label} share the name "${text(nameEn)}"` }
        return { status: 'existing', id: String(found[0]._id), name: found[0].name?.English }
    }

    return rows.map((raw, index) => {
        const errors = []
        const warnings = []
        const row = Number(raw.row) || index + 2
        const nameEn = text(raw.productNameEn)
        const key = nameKey(nameEn)

        if (!key) errors.push('Product English name is missing')
        else if (productNames.has(key)) errors.push('A product with this English name already exists')
        else if (seenNames.has(key)) errors.push(`Same English name as row ${seenNames.get(key)}`)
        if (key && !seenNames.has(key)) seenNames.set(key, row)

        const priceText = text(raw.price)
        const price = Number(priceText)
        if (priceText === '') errors.push('Price is missing')
        else if (!Number.isFinite(price) || price < 0) errors.push(`Price "${priceText}" is not a number of 0 or more`)

        const currency = text(raw.currency).toUpperCase() || 'USD'
        if (!['USD', 'KHR'].includes(currency)) errors.push(`Currency "${text(raw.currency)}" must be USD or KHR`)

        const isStock = parseBool(raw.isStock, false)
        if (isStock === undefined) errors.push(`IS_STOCK "${text(raw.isStock)}" must be TRUE or FALSE`)
        const status = parseBool(raw.status, true)
        if (status === undefined) errors.push(`STATUS "${text(raw.status)}" must be TRUE or FALSE`)

        const barcode = text(raw.barcode)
        if (barcode && productCodes.has(barcode)) warnings.push(`Barcode is already used by "${productCodes.get(barcode)}"`)

        const brand = linkTo(brandIndex, raw.brandNameEn, 'brands')
        const category = linkTo(categoryIndex, raw.categoryNameEn, 'categories')
        if (brand.error) errors.push(brand.error)
        if (category.error) errors.push(category.error)
        if (!text(raw.brandNameEn) && text(raw.brandNameKh)) errors.push('Brand Khmer name given without the English name')
        if (!text(raw.categoryNameEn) && text(raw.categoryNameKh)) errors.push('Category Khmer name given without the English name')

        return {
            row,
            productNameEn: nameEn,
            productNameKh: text(raw.productNameKh),
            brandNameEn: text(raw.brandNameEn),
            brandNameKh: text(raw.brandNameKh),
            categoryNameEn: text(raw.categoryNameEn),
            categoryNameKh: text(raw.categoryNameKh),
            price: priceText === '' ? '' : (Number.isFinite(price) ? price : priceText),
            currency,
            isStock: isStock === undefined ? text(raw.isStock) : isStock,
            status: status === undefined ? text(raw.status) : status,
            barcode,
            description: text(raw.description),
            brand: { status: brand.status, id: brand.id, name: brand.name },
            category: { status: category.status, id: category.id, name: category.name },
            errors,
            warnings,
        }
    })
}

// What a confirmed import will do, for the summary
const summarise = (rows) => {
    const newKeys = (field) => new Set(rows.filter((row) => row[field].status === 'new').map((row) => nameKey(row[field].name)))
    return {
        rows: rows.length,
        errors: rows.filter((row) => row.errors.length).length,
        warnings: rows.filter((row) => row.warnings.length).length,
        newBrands: newKeys('brand').size,
        newCategories: newKeys('category').size,
    }
}

exports.productTemplate = async (req, res) => {
    try {
        const workbook = new Workbook()
        // BARCODE as a text column, so Excel keeps leading zeros (0123…)
        addSheet(workbook, 'PRODUCTS', COLUMNS.map(({ header, key, width }) => ({ header, key, width, numFmt: key === 'barcode' ? '@' : undefined })), [{
            productNameEn: 'Ballpoint Pen Blue 0.5mm',
            productNameKh: 'ប៊ិចខៀវ 0.5mm',
            brandNameEn: 'Pilot',
            brandNameKh: 'ផៃឡត',
            categoryNameEn: 'Pens',
            categoryNameKh: 'ប៊ិច',
            price: 0.5,
            currency: 'USD',
            isStock: 'TRUE',
            status: 'TRUE',
            barcode: '4902505000000',
            description: 'Example row: replace or delete it',
        }])
        return sendWorkbook(res, workbook, 'PRODUCT_IMPORT_TEMPLATE.xlsx')
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// The uploaded Excel's first sheet as raw rows ({ row, <column key>: cell }),
// or { error } to show. `required`: lists of headers, at least one of each
// list must be present (e.g. [['BARCODE', 'PRODUCT_NAME_EN']])
const readExcelRows = (file, columns, required) => {
    if (!file?.buffer) return { error: 'Choose an Excel file' }
    let sheet
    try {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' })
        sheet = workbook.Sheets[workbook.SheetNames[0]]
    } catch (err) {
        return { error: 'This file could not be read as Excel' }
    }
    const table = xlsx.utils.sheet_to_json(sheet || {}, { header: 1, defval: '', raw: true, blankrows: false })
    if (!table.length) return { error: 'The sheet is empty' }

    const headers = table[0].map(headerKey)
    const missing = required.find((anyOf) => !anyOf.some((header) => headers.includes(header)))
    if (missing) return { error: `Column ${missing.join(' or ')} not found. Use the template from "Download template".` }
    const keyOf = Object.fromEntries(columns.flatMap((column) => [column.header, ...(column.aliases || [])].map((header) => [header, column.key])))
    const rows = table.slice(1)
        .map((cells, index) => {
            const raw = { row: index + 2 }
            headers.forEach((header, column) => {
                if (keyOf[header]) raw[keyOf[header]] = cells[column]
            })
            return raw
        })
        // Fully empty lines aren't rows
        .filter((raw) => columns.some(({ key }) => text(raw[key]) !== ''))
    if (!rows.length) return { error: 'No rows found under the header' }
    return { rows }
}

// Excel (first sheet) → rows checked against the database
exports.previewProducts = async (req, res) => {
    try {
        const { rows, error } = readExcelRows(req.file, COLUMNS, [['PRODUCT_NAME_EN']])
        if (error) return response.failure(422, { msg: error }, res)

        const checked = await validateRows(rows)
        return response.success(200, { data: checked, summary: summarise(checked) }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// One import at a time: two running together could both pass the name check
// and create the same product (or brand / category) twice. The server runs as
// one process, so a flag here covers every request.
let importing = false

// Creates the previewed rows. Refused while any row has an error.
exports.importProducts = async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    if (!rows.length) return response.failure(422, { msg: 'Nothing to import' }, res)
    if (rows.length > 5000) return response.failure(422, { msg: 'Import at most 5000 rows at a time' }, res)
    if (importing) return response.failure(422, { msg: 'Another import is running; try again when it finishes' }, res)
    importing = true
    try {
        return await runImport(req, res, rows)
    } finally {
        importing = false
    }
}

const runImport = async (req, res, rows) => {
    try {
        const checked = await validateRows(rows)
        const failing = checked.filter((row) => row.errors.length)
        if (failing.length) {
            return response.failure(422, { msg: `${failing.length} row(s) have errors; remove them and try again`, data: checked, summary: summarise(checked) }, res)
        }

        // Each new brand / category once, however many rows name it
        const createMissing = async (Model, field, nameEnKey, nameKhKey) => {
            const ids = new Map()
            for (const row of checked) {
                const link = row[field]
                if (link.status === 'existing') ids.set(nameKey(row[nameEnKey]), link.id)
                if (link.status !== 'new' || ids.has(nameKey(row[nameEnKey]))) continue
                const record = await Model.create({
                    name: { English: row[nameEnKey], Khmer: row[nameKhKey] || '' },
                    status: true,
                    createdBy: req.user?.id,
                })
                ids.set(nameKey(row[nameEnKey]), String(record._id))
            }
            return ids
        }
        const brandIds = await createMissing(Brand, 'brand', 'brandNameEn', 'brandNameKh')
        const categoryIds = await createMissing(Category, 'category', 'categoryNameEn', 'categoryNameKh')

        let created = 0
        for (const row of checked) {
            try {
                await createProductRecord({
                    name: { English: row.productNameEn, Khmer: row.productNameKh || '' },
                    price: row.price,
                    currency: row.currency,
                    isStock: row.isStock,
                    status: row.status,
                    code: row.barcode,
                    description: row.description,
                    brand: brandIds.get(nameKey(row.brandNameEn)),
                    category: categoryIds.get(nameKey(row.categoryNameEn)),
                }, req.user?.id)
                created++
            } catch (err) {
                // Say how far it got: the products before this row exist now,
                // so choosing the file again shows them as "already exists"
                console.error(err)
                return response.failure(500, {
                    msg: `Stopped at row ${row.row} ("${row.productNameEn}") after creating ${created} product${created === 1 ? '' : 's'}. Choose the file again: the created ones will show as already existing; remove them and import the rest.`,
                    created,
                }, res)
            }
        }
        const summary = summarise(checked)
        return response.success(200, {
            msg: `Imported ${created} product${created === 1 ? '' : 's'}${summary.newBrands ? `, ${summary.newBrands} new brand${summary.newBrands === 1 ? '' : 's'}` : ''}${summary.newCategories ? `, ${summary.newCategories} new categor${summary.newCategories === 1 ? 'y' : 'ies'}` : ''}`,
            created,
            ...summary,
        }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// ---- Stock ----
// Each row adds one stock batch to an existing product, as "Add stock" does.
// The product is found by BARCODE (its code) when given, else by English name.

const STOCK_COLUMNS = [
    { header: 'BARCODE', key: 'barcode', width: 18, numFmt: '@' },
    { header: 'PRODUCT_NAME_EN', key: 'productNameEn', width: 32 },
    { header: 'COST', key: 'cost', width: 10 },
    { header: 'CURRENCY', key: 'currency', width: 10 },
    { header: 'QUANTITY', key: 'quantity', width: 10 },
    // The batch's own barcode (e.g. a lot label); STOCK_CODE, its earlier
    // name, is still read
    { header: 'STOCK_BARCODE', key: 'code', width: 16, numFmt: '@', aliases: ['STOCK_CODE'] },
    { header: 'EXPIRE_DATE', key: 'expireAt', width: 14, numFmt: 'yyyy-mm-dd' },
    { header: 'ALERT_AT', key: 'alertAt', width: 10 },
    { header: 'NEW_PRICE', key: 'newPrice', width: 11 },
    { header: 'NEW_PRICE_CURRENCY', key: 'newPriceCurrency', width: 20 },
]
const CURRENCIES = ['USD', 'KHR']

// '' when empty, the number, or NaN when it isn't one
const numberCell = (value) => {
    if (typeof value === 'number') return value
    const cell = text(value)
    return cell === '' ? '' : Number(cell)
}

// YYYY-MM-DD, or '' when empty, or undefined when it isn't a valid date.
// Accepts an Excel date cell (a serial number) or text YYYY-MM-DD / YYYY/MM/DD.
const dateCell = (value) => {
    if (value === undefined || value === null || text(value) === '') return ''
    const pad = (n) => String(n).padStart(2, '0')
    if (typeof value === 'number') {
        const parts = xlsx.SSF.parse_date_code(value)
        return parts && parts.y > 1900 ? `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` : undefined
    }
    const match = text(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T.*)?$/)
    if (!match) return undefined
    const [year, month, day] = match.slice(1).map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
    return `${year}-${pad(month)}-${pad(day)}`
}

// Checks every row against the database and against earlier rows. Shared by
// preview and import, so the server enforces exactly what the preview shows.
const validateStockRows = async (rows, user) => {
    const products = await Product.find({ isDeleted: { $ne: true } }).select('name code isStock price currency').lean()
    const byName = indexByName(products)
    const byCode = new Map()
    products.forEach((product) => {
        const code = text(product.code)
        if (!code) return
        byCode.set(code, [...(byCode.get(code) || []), product])
    })
    const mayChangePrice = canChangePrice(user)
    const firstRowOf = new Map()

    return rows.map((raw, index) => {
        const errors = []
        const warnings = []
        const row = Number(raw.row) || index + 2
        const barcode = text(raw.barcode)
        const nameEn = text(raw.productNameEn)

        // Which product
        let product = null
        let matchedBy = null
        const codeMatches = barcode ? byCode.get(barcode) || [] : []
        if (codeMatches.length > 1) {
            errors.push(`${codeMatches.length} products share barcode ${barcode}`)
        } else if (codeMatches.length === 1) {
            product = codeMatches[0]
            matchedBy = 'barcode'
            if (nameEn && nameKey(nameEn) !== nameKey(product.name?.English)) warnings.push(`Barcode ${barcode} belongs to "${product.name?.English}", not "${nameEn}"`)
        } else if (nameEn) {
            const nameMatches = byName.get(nameKey(nameEn)) || []
            if (nameMatches.length > 1) errors.push(`${nameMatches.length} products share the name "${nameEn}"`)
            else if (nameMatches.length === 0) errors.push(barcode ? `No product with barcode ${barcode} or the name "${nameEn}"` : `No product named "${nameEn}"`)
            else {
                product = nameMatches[0]
                matchedBy = 'name'
                if (barcode) warnings.push(`Barcode ${barcode} not found; matched by name`)
            }
        } else {
            errors.push(barcode ? `No product with barcode ${barcode}` : 'BARCODE or PRODUCT_NAME_EN is needed')
        }

        if (product) {
            const id = String(product._id)
            if (!product.isStock) warnings.push('This product does not track stock yet; importing turns it on')
            if (firstRowOf.has(id)) warnings.push(`Same product as row ${firstRowOf.get(id)}: adds another batch`)
            else firstRowOf.set(id, row)
        }

        // Batch values
        const cost = numberCell(raw.cost)
        if (cost === '') errors.push('Cost is missing')
        else if (!Number.isFinite(cost) || cost < 0) errors.push(`Cost "${text(raw.cost)}" is not a number of 0 or more`)

        const currency = text(raw.currency).toUpperCase() || 'USD'
        if (!CURRENCIES.includes(currency)) errors.push(`Currency "${text(raw.currency)}" must be USD or KHR`)

        const quantity = numberCell(raw.quantity)
        if (quantity === '') errors.push('Quantity is missing')
        else if (!Number.isFinite(quantity) || quantity <= 0) errors.push(`Quantity "${text(raw.quantity)}" is not a number above 0`)

        const alertAt = numberCell(raw.alertAt)
        if (alertAt !== '' && (!Number.isFinite(alertAt) || alertAt < 0)) errors.push(`Alert at "${text(raw.alertAt)}" is not a number of 0 or more`)

        const expireAt = dateCell(raw.expireAt)
        if (expireAt === undefined) errors.push(`Expire date "${text(raw.expireAt)}" is not a date (use YYYY-MM-DD)`)

        // Optional new selling price, as on the Add stock form
        const newPrice = numberCell(raw.newPrice)
        let newPriceCurrency = text(raw.newPriceCurrency).toUpperCase()
        let changesPrice = false
        if (newPrice !== '') {
            newPriceCurrency = newPriceCurrency || product?.currency || 'USD'
            if (!Number.isFinite(newPrice) || newPrice < 0) errors.push(`New price "${text(raw.newPrice)}" is not a number of 0 or more`)
            else if (!CURRENCIES.includes(newPriceCurrency)) errors.push(`New price currency "${text(raw.newPriceCurrency)}" must be USD or KHR`)
            else if (!mayChangePrice) errors.push('You are not allowed to change prices: leave NEW_PRICE empty')
            else if (product && product.price === newPrice && (product.currency || 'USD') === newPriceCurrency) warnings.push('New price is the current price: nothing changes')
            else changesPrice = true
        } else if (newPriceCurrency) {
            warnings.push('New price currency given without a new price: ignored')
            newPriceCurrency = ''
        }

        const keep = (value) => (Number.isFinite(value) ? value : text(value))
        return {
            row,
            barcode,
            productNameEn: nameEn,
            cost: cost === '' ? '' : keep(cost),
            currency,
            quantity: quantity === '' ? '' : keep(quantity),
            code: text(raw.code),
            expireAt: expireAt === undefined ? text(raw.expireAt) : expireAt,
            alertAt: alertAt === '' ? '' : keep(alertAt),
            newPrice: newPrice === '' ? '' : keep(newPrice),
            newPriceCurrency,
            product: product ? { id: String(product._id), name: product.name?.English, matchedBy, isStock: !!product.isStock } : null,
            changesPrice,
            errors,
            warnings,
        }
    })
}

const summariseStock = (rows) => {
    const matched = rows.filter((row) => row.product)
    return {
        rows: rows.length,
        errors: rows.filter((row) => row.errors.length).length,
        warnings: rows.filter((row) => row.warnings.length).length,
        products: new Set(matched.map((row) => row.product.id)).size,
        quantity: rows.reduce((sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0), 0),
        stockTurnsOn: new Set(matched.filter((row) => !row.product.isStock).map((row) => row.product.id)).size,
        priceChanges: rows.filter((row) => row.changesPrice).length,
    }
}

// Columns a person fills; a row with none of them filled is a product left
// out (e.g. from a prefilled template), not a row with errors
const STOCK_VALUE_KEYS = ['cost', 'quantity', 'code', 'expireAt', 'alertAt', 'newPrice']
// Read-only columns of a prefilled template, after the import columns. The
// import doesn't read them (unknown headers are ignored).
const STOCK_INFO_COLUMNS = [
    { header: 'BRAND', key: 'brand', width: 18 },
    { header: 'CATEGORY', key: 'category', width: 18 },
    { header: 'CURRENT_PRICE', key: 'currentPrice', width: 15 },
    { header: 'IN_STOCK', key: 'inStock', width: 10 },
]
const objectIds = (value) => (Array.isArray(value) ? value : []).filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id))

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Brands and categories for the template dialog's filters
exports.stockTemplateOptions = async (req, res) => {
    try {
        const [brands, categories] = await Promise.all([Brand, Category].map((Model) =>
            Model.find({ isDeleted: { $ne: true } }).select('name').collation({ locale: 'en', numericOrdering: true }).sort({ 'name.English': 1 }).lean()))
        const option = (record) => ({ id: String(record._id), name: record.name?.English || '--' })
        return response.success(200, { data: { brands: brands.map(option), categories: categories.map(option) } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// The template dialog's product filters: search (spaces ignored, matched on
// the product's tags, as the product lists search), one brand, one category
// ('all' or empty = any), status ('all' / 'active' / 'inactive'), date added
// from / to, and `only` (ids: show just these, e.g. the selected ones)
const pickerQuery = (body) => {
    const query = { isDeleted: { $ne: true } }
    if (Array.isArray(body.only)) query._id = { $in: objectIds(body.only) }
    const search = text(body.search).replace(/ /g, '')
    if (search) query.tags = { $regex: new RegExp(escapeRegExp(search), 'i') }
    if (body.brand && body.brand !== 'all') {
        if (!mongoose.Types.ObjectId.isValid(body.brand)) return { error: 'Unknown brand' }
        query.brand = new mongoose.Types.ObjectId(body.brand)
    }
    if (body.category && body.category !== 'all') {
        if (!mongoose.Types.ObjectId.isValid(body.category)) return { error: 'Unknown category' }
        query.category = new mongoose.Types.ObjectId(body.category)
    }
    if (body.status === 'active') query.status = true
    else if (body.status === 'inactive') query.status = false
    const from = body.from ? new Date(body.from) : null
    const to = body.to ? new Date(body.to) : null
    if ((from && isNaN(from)) || (to && isNaN(to))) return { error: 'A date is not valid' }
    if (from && to && from > to) return { error: 'The "from" date is after the "to" date' }
    if (from || to) query.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) }
    return { query }
}

// The template dialog's product grid: one page of matching products (by name)
// and the ids of every match, for "Select all" beyond the loaded pages
exports.stockTemplateProducts = async (req, res) => {
    try {
        const body = req.body || {}
        const { query, error } = pickerQuery(body)
        if (error) return response.failure(422, { msg: error }, res)
        const offset = Math.max(0, parseInt(body.offset, 10) || 0)
        const limit = Math.min(200, Math.max(1, parseInt(body.limit, 10) || 60))
        const byName = { locale: 'en', numericOrdering: true }
        const [ids, page] = await Promise.all([
            Product.find(query).select('_id').lean(),
            Product.find(query)
                .select('name price currency status profile')
                .populate('profile', 'filename')
                .collation(byName)
                .sort({ 'name.English': 1, _id: 1 })
                .skip(offset)
                .limit(limit)
                .lean(),
        ])
        const inStock = new Map((await ProductStock.aggregate([
            { $match: { product: { $in: page.map((product) => product._id) } } },
            { $group: { _id: '$product', quantity: { $sum: '$quantity' } } },
        ])).map((item) => [String(item._id), item.quantity]))
        const data = page.map(withFallbackProfile).map((product) => ({
            id: String(product._id),
            name: product.name?.English || '--',
            picture: product.profile?.filename || '',
            price: product.price ?? 0,
            currency: product.currency || 'USD',
            status: product.status !== false,
            inStock: inStock.get(String(product._id)) || 0,
        }))
        return response.success(200, { data, ids: ids.map((product) => String(product._id)), total: ids.length }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// GET: the empty template with one example row. POST { ids }: prefilled with
// the chosen products (barcode, name, currency, plus read-only info columns)
exports.stockTemplate = async (req, res) => {
    try {
        const workbook = new Workbook()
        if (req.method === 'GET') {
            // BARCODE and STOCK_BARCODE as text columns, so Excel keeps leading zeros
            addSheet(workbook, 'STOCK', STOCK_COLUMNS, [{
                barcode: '4902505000000',
                productNameEn: 'Ballpoint Pen Blue 0.5mm',
                cost: 0.3,
                currency: 'USD',
                quantity: 100,
                code: '',
                expireAt: '',
                alertAt: 10,
                newPrice: '',
                newPriceCurrency: '',
            }])
            return sendWorkbook(res, workbook, 'STOCK_IMPORT_TEMPLATE.xlsx')
        }

        const ids = objectIds(req.body?.ids)
        if (!ids.length) return response.failure(422, { msg: 'Choose at least one product' }, res)
        if (ids.length > 5000) return response.failure(422, { msg: 'Choose at most 5000 products: an import takes at most 5000 rows' }, res)
        const products = await Product.find({ _id: { $in: ids }, isDeleted: { $ne: true } })
            .select('name code price currency brand category')
            .populate('brand', 'name')
            .populate('category', 'name')
            .lean()
        if (!products.length) return response.failure(422, { msg: 'None of the chosen products exist any more' }, res)

        const inStock = new Map((await ProductStock.aggregate([
            { $match: { product: { $in: products.map((product) => product._id) } } },
            { $group: { _id: '$product', quantity: { $sum: '$quantity' } } },
        ])).map((item) => [String(item._id), item.quantity]))

        const byText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
        const rows = products
            .map((product) => ({
                barcode: text(product.code),
                productNameEn: text(product.name?.English),
                currency: product.currency || 'USD',
                brand: text(product.brand?.name?.English),
                category: text(product.category?.name?.English),
                currentPrice: `${product.price ?? 0} ${product.currency || 'USD'}`,
                inStock: inStock.get(String(product._id)) || 0,
            }))
            // By brand (products without one last), then name
            .sort((a, b) => (!a.brand - !b.brand) || byText(a.brand, b.brand) || byText(a.productNameEn, b.productNameEn))
        addSheet(workbook, 'STOCK', [...STOCK_COLUMNS, ...STOCK_INFO_COLUMNS], rows)
        return sendWorkbook(res, workbook, `STOCK_IMPORT_${rows.length}_PRODUCTS.xlsx`)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.previewStock = async (req, res) => {
    try {
        const { rows: read, error } = readExcelRows(req.file, STOCK_COLUMNS, [['BARCODE', 'PRODUCT_NAME_EN'], ['COST'], ['QUANTITY']])
        if (error) return response.failure(422, { msg: error }, res)
        const rows = read.filter((raw) => STOCK_VALUE_KEYS.some((key) => text(raw[key]) !== ''))
        if (!rows.length) return response.failure(422, { msg: 'No row has a COST or QUANTITY yet: fill them for the products you are adding stock to' }, res)
        const checked = await validateStockRows(rows, req.user)
        return response.success(200, { data: checked, summary: summariseStock(checked) }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Adds the previewed rows as stock batches. Refused while any row has an error.
// Shares the one-import-at-a-time flag with the product import.
exports.importStock = async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    if (!rows.length) return response.failure(422, { msg: 'Nothing to import' }, res)
    if (rows.length > 5000) return response.failure(422, { msg: 'Import at most 5000 rows at a time' }, res)
    if (importing) return response.failure(422, { msg: 'Another import is running; try again when it finishes' }, res)
    importing = true
    try {
        return await runStockImport(req, res, rows)
    } finally {
        importing = false
    }
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

const runStockImport = async (req, res, rows) => {
    try {
        const checked = await validateStockRows(rows, req.user)
        const failing = checked.filter((row) => row.errors.length)
        if (failing.length) {
            return response.failure(422, { msg: `${plural(failing.length, 'row has', 'rows have')} errors; remove them and try again`, data: checked, summary: summariseStock(checked) }, res)
        }

        let added = 0
        let pricesChanged = 0
        const products = new Set()
        const turnedOn = new Set()
        for (const row of checked) {
            // How far this row got: 'batch' (nothing saved yet), 'price' (batch added)
            let stage = 'batch'
            let stockId = null
            try {
                // Inserted directly and linked in one update, like a stock
                // conversion: the ProductStock save hook re-saves the whole
                // product without waiting, which loses links (or crashes) when
                // many rows add to the same product in a row
                const stock = new ProductStock({
                    product: row.product.id,
                    cost: row.cost,
                    currency: row.currency,
                    quantity: row.quantity,
                    totalQuantity: row.quantity,
                    code: row.code,
                    expireAt: row.expireAt ? new Date(`${row.expireAt}T00:00:00Z`) : undefined,
                    alertAt: row.alertAt === '' ? 0 : row.alertAt,
                })
                await stock.validate()
                const now = new Date()
                await ProductStock.collection.insertOne({ ...stock.toObject(), createdAt: now, updatedAt: now })
                stockId = stock._id
                await Product.updateOne({ _id: row.product.id }, { $addToSet: { stocks: stock._id }, $set: { isStock: true } })
                stage = 'price'
                added++
                products.add(row.product.id)
                if (!row.product.isStock) turnedOn.add(row.product.id)

                if (row.changesPrice) {
                    const changed = await applyNewPrice({
                        productId: row.product.id,
                        newPrice: row.newPrice,
                        newCurrency: row.newPriceCurrency,
                        cost: row.cost,
                        costCurrency: row.currency,
                        source: 'STOCK_IMPORT',
                        stock: stock._id,
                        userId: req.user?.id,
                    })
                    if (changed) pricesChanged++
                }
            } catch (err) {
                console.error(err)
                // A batch saved but not linked to its product would never show:
                // remove it, so this row counts as not added
                if (stage === 'batch' && stockId) await ProductStock.deleteOne({ _id: stockId }).catch(() => {})
                // Batches can't be told apart from new ones, so importing the
                // same file again would add them twice: say what to remove
                const thisRowAdded = stage === 'price'
                return response.failure(500, {
                    msg: `Stopped at row ${row.row} ("${row.product.name}") after adding ${plural(added, 'stock batch', 'stock batches')}.`
                        + (thisRowAdded ? ` Row ${row.row}'s batch was added, but its new price was not saved.` : '')
                        + ` Before importing again, delete the rows above row ${row.row}${thisRowAdded ? ' and that row' : ''} from the file, or they will be added twice.`,
                    added,
                }, res)
            }
        }
        return response.success(200, {
            msg: `Added ${plural(added, 'stock batch', 'stock batches')} to ${plural(products.size, 'product', 'products')}`
                + (turnedOn.size ? `; stock turned on for ${plural(turnedOn.size, 'product', 'products')}` : '')
                + (pricesChanged ? `; ${plural(pricesChanged, 'price', 'prices')} changed` : ''),
            added,
            products: products.size,
            stockTurnedOn: turnedOn.size,
            pricesChanged,
        }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// ---- Images ----

const TARGETS = {
    product: { Model: Product, field: 'profile', Picture: Image },
    brand: { Model: Brand, field: 'icon', Picture: Icon },
    category: { Model: Category, field: 'icon', Picture: Icon },
}

// The name a file stands for: its name without the extension
const fileKey = (fileName) => nameKey(path.parse(String(fileName || '')).name)

// Each file → what an upload would do with it. A file is matched by its name,
// unless `ids[i]` assigns it to a record by hand (e.g. picked in the product
// list because the name didn't match). Two files for one record: the first wins.
const matchImages = async (target, fileNames, ids = []) => {
    const { Model, field } = TARGETS[target]
    const records = await Model.find({ isDeleted: { $ne: true } }).select(`name ${field}`).lean()
    const index = indexByName(records)
    const byId = new Map(records.map((record) => [String(record._id), record]))
    const taken = new Set()
    return fileNames.map((fileName, i) => {
        const result = { file: fileName }
        const assigned = ids[i] ? String(ids[i]) : ''
        let record
        if (assigned) {
            record = byId.get(assigned)
            if (!record) return { ...result, status: 'no-match', chosen: true }
            result.chosen = true
        } else {
            const key = fileKey(fileName)
            const found = key ? index.get(key) : null
            if (!found) return { ...result, status: 'no-match' }
            if (found.length > 1) return { ...result, status: 'ambiguous', name: found[0].name?.English, count: found.length }
            record = found[0]
        }
        const id = String(record._id)
        const named = { ...result, id, name: record.name?.English }
        if (taken.has(id)) return { ...named, status: 'duplicate-file' }
        taken.add(id)
        return { ...named, status: record[field] ? 'has-picture' : 'will-set' }
    })
}

// Optional per-file record ids: an array, or a JSON array in a form field
const readIds = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === 'string' && value) {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch (err) { return [] }
    }
    return []
}

exports.previewImages = async (req, res) => {
    try {
        const { target, names, ids } = req.body || {}
        if (!TARGETS[target]) return response.failure(422, { msg: 'Choose product, brand or category' }, res)
        if (!Array.isArray(names) || !names.length) return response.failure(422, { msg: 'Choose some images' }, res)
        const data = await matchImages(target, names.map(String), readIds(ids))
        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// Stores and attaches the images that still have a missing picture to fill.
// Files are only written to storage once matched, so nothing is left orphaned.
exports.uploadImages = async (req, res) => {
    try {
        const target = req.body?.target
        if (!TARGETS[target]) return response.failure(422, { msg: 'Choose product, brand or category' }, res)
        const files = req.files || []
        if (!files.length) return response.failure(422, { msg: 'No images received' }, res)

        const { Model, field, Picture } = TARGETS[target]
        const matches = await matchImages(target, files.map((file) => file.originalname), readIds(req.body?.ids))
        const results = []
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const match = matches[i]
            if (match.status !== 'will-set') {
                results.push({ file: file.originalname, status: match.status, name: match.name })
                continue
            }
            const objectName = `${Date.now()}${crypto.randomBytes(3).toString('hex')}${path.extname(file.originalname).toLowerCase()}`
            let picture
            // Each file on its own: one storage failure doesn't fail (or
            // misreport) the others in the batch
            try {
                await minioClient.putObject(process.env.MINIO_BUCKET, objectName, file.buffer, file.size, { mimetype: file.mimetype })
                picture = await Picture.create({ filename: objectName, isActive: true })
                // Only where still empty: a picture set since the preview is kept
                const update = target === 'product'
                    ? { $set: { [field]: picture._id }, $push: { images: picture._id } }
                    : { $set: { [field]: picture._id } }
                const { modifiedCount } = await Model.updateOne({ _id: match.id, $or: [{ [field]: null }, { [field]: { $exists: false } }] }, update)
                if (modifiedCount) {
                    results.push({ file: file.originalname, status: 'set', name: match.name })
                } else {
                    // Lost the race: undo this picture
                    await Picture.deleteOne({ _id: picture._id }).catch(() => {})
                    await minioClient.removeObject(process.env.MINIO_BUCKET, objectName).catch(() => {})
                    results.push({ file: file.originalname, status: 'has-picture', name: match.name })
                }
            } catch (err) {
                console.error(err)
                if (picture) await Picture.deleteOne({ _id: picture._id }).catch(() => {})
                await minioClient.removeObject(process.env.MINIO_BUCKET, objectName).catch(() => {})
                results.push({ file: file.originalname, status: 'failed', name: match.name })
            }
        }
        const set = results.filter((result) => result.status === 'set').length
        return response.success(200, { msg: `${set} picture${set === 1 ? '' : 's'} set`, data: results, set }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// ---- Find online (Pexels) ----

const pexels = require('../helpers/pexels')

// A user-facing Pexels message, or the generic one
const failMessage = (err) => (err?.userMessage ? err.message : failureMsg.trouble)

exports.onlineStatus = (req, res) => response.success(200, { data: { enabled: pexels.isEnabled() } }, res)

// The chosen products, for the review list
exports.onlineProducts = async (req, res) => {
    try {
        const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => mongoose.Types.ObjectId.isValid(id))
        if (!ids.length) return response.failure(422, { msg: 'Choose some products' }, res)
        const products = await Product.find({ _id: { $in: ids }, isDeleted: { $ne: true } })
            .select('name brand profile')
            .populate('brand', 'name')
            .populate('profile', 'filename')
            .lean()
        const byId = new Map(products.map((product) => [String(product._id), product]))
        // Same order as chosen
        const data = ids.map((id) => byId.get(String(id))).filter(Boolean).map((product) => ({
            id: String(product._id),
            name: product.name?.English || '',
            brand: product.brand?.name?.English || '',
            picture: product.profile?.filename || null,
        }))
        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.onlineSearch = async (req, res) => {
    try {
        const query = text(req.body?.query)
        const page = Math.max(1, Math.min(50, parseInt(req.body?.page, 10) || 1))
        if (!query) return response.failure(422, { msg: 'Type something to search for' }, res)
        const data = await pexels.search(query, page)
        return response.success(200, { data }, res)
    } catch (err) {
        return response.failure(422, { msg: failMessage(err) }, res, err.userMessage ? undefined : err)
    }
}

// Stores an image and makes it the product's picture; the old picture stays
// in the product's extra images. Nothing is left in storage if it fails.
const attachProductPicture = async (productId, buffer, mimetype, extension) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw Object.assign(new Error('Unknown product'), { userMessage: true })
    const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } }).select('profile').lean()
    if (!product) throw Object.assign(new Error('Product not found'), { userMessage: true })

    const objectName = `${Date.now()}${crypto.randomBytes(3).toString('hex')}${extension}`
    try {
        await minioClient.putObject(process.env.MINIO_BUCKET, objectName, buffer, buffer.length, { mimetype })
        const picture = await Image.create({ filename: objectName, isActive: true })

        const keep = [picture._id, product.profile].filter(Boolean)
        const { matchedCount } = await Product.updateOne(
            { _id: productId, isDeleted: { $ne: true } },
            { $set: { profile: picture._id }, $addToSet: { images: { $each: keep } } }
        )
        if (!matchedCount) {
            await Image.deleteOne({ _id: picture._id }).catch(() => {})
            throw Object.assign(new Error('Product was removed meanwhile'), { userMessage: true })
        }
        return { replaced: !!product.profile }
    } catch (err) {
        await minioClient.removeObject(process.env.MINIO_BUCKET, objectName).catch(() => {})
        throw err
    }
}

// Downloads each picked photo and makes it the product's picture
exports.onlineSave = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : []
        if (!items.length) return response.failure(422, { msg: 'Pick some photos first' }, res)
        if (items.length > 10) return response.failure(422, { msg: 'Save at most 10 photos at a time' }, res)

        const results = []
        for (const item of items) {
            const productId = String(item?.productId || '')
            const result = { productId }
            try {
                if (!mongoose.Types.ObjectId.isValid(productId)) throw Object.assign(new Error('Unknown product'), { userMessage: true })
                const exists = await Product.exists({ _id: productId, isDeleted: { $ne: true } })
                if (!exists) throw Object.assign(new Error('Product not found'), { userMessage: true })

                // The image address comes from Pexels itself, never from the request
                const info = await pexels.photo(item.photoId)
                const { buffer, mimetype } = await pexels.download(info?.src?.large || info?.src?.original)
                const { replaced } = await attachProductPicture(productId, buffer, mimetype, '.jpg')
                results.push({ ...result, status: 'set', replaced })
            } catch (err) {
                if (!err.userMessage) console.error(err)
                results.push({ ...result, status: 'failed', msg: failMessage(err) })
            }
        }
        const set = results.filter((result) => result.status === 'set').length
        return response.success(200, { msg: `${set} picture${set === 1 ? '' : 's'} saved`, data: results, set }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// A photo taken with the camera (Find online › Take photo) becomes the
// product's picture, the same way as a picked Pexels photo
const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
exports.onlinePhoto = async (req, res) => {
    try {
        const file = req.file
        if (!file) return response.failure(422, { msg: 'No photo received' }, res)
        const extension = PHOTO_TYPES[file.mimetype]
        if (!extension) return response.failure(422, { msg: 'Send a JPEG, PNG or WebP photo' }, res)
        const productId = String(req.body?.productId || '')
        const { replaced } = await attachProductPicture(productId, file.buffer, file.mimetype, extension)
        return response.success(200, { msg: 'Picture saved', data: { productId, status: 'set', replaced } }, res)
    } catch (err) {
        return response.failure(422, { msg: failMessage(err) }, res, err.userMessage ? undefined : err)
    }
}

// For tests
exports._nameKey = nameKey
exports._validateRows = validateRows
