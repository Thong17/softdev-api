// Admin › Migration: import products from Excel by name (brand and category
// matched, or created, by English name) and attach images in bulk by file name.
const path = require('path')
const crypto = require('crypto')
const xlsx = require('xlsx')
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const Image = require('../models/Image')
const Icon = require('../models/Icon')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { Workbook, addSheet, sendWorkbook } = require('../helpers/excel')
const { minioClient } = require('../configs/multer')
const { createProductRecord } = require('./productController')

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
const keyByHeader = Object.fromEntries(COLUMNS.map((column) => [column.header, column.key]))

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

// Excel (first sheet) → rows checked against the database
exports.previewProducts = async (req, res) => {
    try {
        if (!req.file?.buffer) return response.failure(422, { msg: 'Choose an Excel file' }, res)
        let sheet
        try {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' })
            sheet = workbook.Sheets[workbook.SheetNames[0]]
        } catch (err) {
            return response.failure(422, { msg: 'This file could not be read as Excel' }, res)
        }
        const table = xlsx.utils.sheet_to_json(sheet || {}, { header: 1, defval: '', raw: true, blankrows: false })
        if (!table.length) return response.failure(422, { msg: 'The sheet is empty' }, res)

        const headers = table[0].map(headerKey)
        if (!headers.includes('PRODUCT_NAME_EN')) {
            return response.failure(422, { msg: 'Column PRODUCT_NAME_EN not found. Use the template from "Download template".' }, res)
        }
        const rows = table.slice(1)
            .map((cells, index) => {
                const raw = { row: index + 2 }
                headers.forEach((header, column) => {
                    if (keyByHeader[header]) raw[keyByHeader[header]] = cells[column]
                })
                return raw
            })
            // Fully empty lines aren't rows
            .filter((raw) => COLUMNS.some(({ key }) => text(raw[key]) !== ''))
        if (!rows.length) return response.failure(422, { msg: 'No product rows found under the header' }, res)

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

// Downloads each picked photo and makes it the product's picture. The old
// picture stays in the product's extra images.
exports.onlineSave = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : []
        if (!items.length) return response.failure(422, { msg: 'Pick some photos first' }, res)
        if (items.length > 10) return response.failure(422, { msg: 'Save at most 10 photos at a time' }, res)

        const results = []
        for (const item of items) {
            const productId = String(item?.productId || '')
            const result = { productId }
            let objectName
            try {
                if (!mongoose.Types.ObjectId.isValid(productId)) throw Object.assign(new Error('Unknown product'), { userMessage: true })
                const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } }).select('profile').lean()
                if (!product) throw Object.assign(new Error('Product not found'), { userMessage: true })

                // The image address comes from Pexels itself, never from the request
                const info = await pexels.photo(item.photoId)
                const { buffer, mimetype } = await pexels.download(info?.src?.large || info?.src?.original)
                objectName = `${Date.now()}${crypto.randomBytes(3).toString('hex')}.jpg`
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
                results.push({ ...result, status: 'set', replaced: !!product.profile })
            } catch (err) {
                // Nothing left behind for a photo that wasn't attached
                if (objectName) await minioClient.removeObject(process.env.MINIO_BUCKET, objectName).catch(() => {})
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

// For tests
exports._nameKey = nameKey
exports._validateRows = validateRows
