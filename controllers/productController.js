const Product = require('../models/Product')
const Brand = require('../models/Brand')
const Image = require('../models/Image')
const ProductColor = require('../models/ProductColor')
const ProductOption = require('../models/ProductOption')
const ProductProperty = require('../models/ProductProperty')
const ProductStock = require('../models/ProductStock')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createProductValidation, createPropertyValidation, createOptionValidation, createColorValidation, createCustomerOptionValidation } = require('../middleware/validations/productValidation')
const Category = require('../models/Category')
const CustomerOption = require('../models/CustomerOption')
const { Workbook } = require('exceljs')
const { worksheetOption } = require('../configs/excel')
const moment = require('moment')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit)
    const offset = parseInt(req.query.offset) || 0
    const search = req.query.search?.replace(/ /g,'') || ''
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }

    Product.find({ isDeleted: false, store: req.store, ...query }, async (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        const totalCount = await Product.count({ isDeleted: false, store: req.store, ...query  })
        let hasMore = totalCount > offset + limit
        if (search !== '') hasMore = true
        return response.success(200, { data: products, length: totalCount, hasMore }, res)
    })
        .skip(offset).limit(limit)
        .sort(filterObj)
        .populate('profile')
        .populate('category')
        .populate('brand')
        .populate('images')
        .populate('properties')
        .populate('stocks')
        .populate({ path: 'colors', model: ProductColor, populate: { path: 'images', model: Image } })
        .populate({ path: 'customers', model: CustomerOption })
        .populate({ path: 'options', model: ProductOption, populate: { path: 'profile', model: Image } })
}

exports.list = async (req, res) => {
    const limit = parseInt(req.query.limit)
    const offset = parseInt(req.query.offset) || 0
    const search = req.query.search?.replace(/ /g,'') || ''
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'
    const brand = req.query.brand || 'all'
    const category = req.query.category || 'all'
    const promotion = req.query.promotion
    const favorite = req.query.favorite === 'on'
    const promotions = req.query.promotions === 'on'

    let filterObj = { [filter]: sort }
    let query = {}
    if (search) {
        query[field] = {
            $regex: new RegExp(search, 'i')
        }
    }
    let promotionObj = {}
    if (promotions) promotionObj['$ne'] = null
    if (promotion) promotionObj['$e'] = promotion

    if (Object.keys(promotionObj).length > 0) query['promotion'] = promotionObj
    if (brand && brand !== 'all') query['brand'] = brand
    if (category && category !== 'all') query['category'] = category
    if (favorite) query['_id'] = { '$in': req.user?.favorites }

    Product.find({ isDeleted: false, status: true, store: req.store, ...query }, async (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        const totalCount = await Product.count({ isDeleted: false, status: true, store: req.store, ...query  })
        let hasMore = totalCount > offset + limit
        if (search !== '' || brand !== 'all' || category !== 'all' || promotion || favorite || promotions) hasMore = true

        return response.success(200, { data: products, length: totalCount, hasMore }, res)
    })  
        .skip(offset).limit(limit)
        .sort(filterObj)
        .populate('profile')
        .populate('category', 'name tags')
        .populate('brand', 'name tags')
        .populate('stocks')
        .populate('promotion', 'description isFixed startAt expireAt type value')
}

exports.listCode = async (req, res) => {
    Product.find({ isDeleted: false, store: req.store }, (err, products) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        return response.success(200, { data: products.map(product => {
            return {
                ...product._doc,
                stockCodes: product.stocks?.map(stock => stock.code)
            }
        }) }, res)
    })  
        .select('code isStock stocks').populate('stocks', 'code')
}

exports.listTemplate = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: false, isTemplate: true })
            .populate('brand')
            .populate('category')
            .populate('images')
        return response.success(200, { data: products }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.cloneFromTemplate = async (req, res) => {
    try {
        const template = await Product.findOne({ _id: req.params.id, isTemplate: true, isDeleted: false })
        if (!template) return response.failure(422, { msg: 'Template not found!' }, res)

        const product = await Product.create({
            name: template.name,
            price: template.price,
            currency: template.currency,
            condition: template.condition,
            code: template.code,
            description: template.description,
            profile: template.profile,
            brand: template.brand,
            category: template.category,
            images: template.images,
            store: req.store,
            clonedFrom: template.id,
            createdBy: req.user.id
        })

        if (product.category) {
            const category = await Category.findById(product.category).select('products')
            if (category) await Category.findByIdAndUpdate(product.category, { products: [...category.products, product._id] })
        }
        if (product.brand) {
            const brand = await Brand.findById(product.brand).select('products')
            if (brand) await Brand.findByIdAndUpdate(product.brand, { products: [...brand.products, product._id] })
        }

        response.success(200, { msg: 'Product has been added from template successfully', data: product }, res)
    } catch (err) {
        return response.failure(422, { msg: err.message || failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, store: req.store })
            .populate('brand')
            .populate('category')
            .populate('images')
            .populate({ path: 'properties', options: { sort: { 'order': 1 } }})
            .populate({ path: 'colors', model: ProductColor })
            .populate({ path: 'customers', model: CustomerOption })
            .populate({ path: 'options', model: ProductOption })

        return response.success(200, { data: product }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.info = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, store: req.store })
            .populate('brand')
            .populate('category')
            .populate('images')
            .populate({ path: 'properties', options: { sort: { 'order': 1 } }})
            .populate({ path: 'colors', model: ProductColor })
            .populate({ path: 'customers', model: CustomerOption })
            .populate({ path: 'options', model: ProductOption })
            .populate({ path: 'stocks', model: ProductStock })

        return response.success(200, { data: product }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createProductValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Product.create({...body, store: req.store, createdBy: req.user.id}, async (err, product) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Product already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product created!' }, res, err)

            const category = await Category.findById(product.category).select('products')
            const brand = await Brand.findById(product.brand).select('products')

            const listCategory = [...category.products, product._id]
            const listBrand = [...brand.products, product._id]

            await Category.findByIdAndUpdate(product.category, { products: listCategory })
            await Brand.findByIdAndUpdate(product.brand, { products: listBrand })

            await Image.updateMany({ _id: { $in: product.images } }, { $set: { isActive: true } }, { multi:true })
            response.success(200, { msg: 'Product has created successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createProductValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const productId = req.params.id
        const oldProduct = await Product.findOne({ _id: productId, store: req.store })
        if (!oldProduct) return response.failure(422, { msg: 'No product found for this store!' }, res)
        const oldCategory = await Category.findById(oldProduct.category).select('products')
        const oldBrand = await Brand.findById(oldProduct.brand).select('products')

        const oldListCategory = oldCategory.products.filter(id => !id.equals(productId))
        const oldListBrand = oldBrand.products.filter(id => !id.equals(productId))

        await Category.findByIdAndUpdate(oldProduct.category, { products: oldListCategory })
        await Brand.findByIdAndUpdate(oldProduct.brand, { products: oldListBrand })

        Product.findOneAndUpdate({ _id: productId, store: req.store }, body, { new: true }, async (err, product) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product updated!' }, res, err)

            const category = await Category.findById(product.category).select('products')
            const brand = await Brand.findById(product.brand).select('products')

            const listCategory = [...category.products, product._id]
            const listBrand = [...brand.products, product._id]

            await Category.findByIdAndUpdate(product.category, { products: listCategory })
            await Brand.findByIdAndUpdate(product.brand, { products: listBrand })

            response.success(200, { msg: 'Product has updated successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.enableStock = async (req, res) => {
    try {
        Product.findOneAndUpdate({ _id: req.params.id, store: req.store }, { isStock: true }, (err, product) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!product) return response.failure(422, { msg: 'No product updated!' }, res, err)
            response.success(200, { msg: 'Product has updated successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Product.findOneAndUpdate({ _id: req.params.id, store: req.store }, { isDeleted: true }, (err, product) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!product) return response.failure(422, { msg: 'No product deleted!' }, res, err)
            response.success(200, { msg: 'Product has deleted successfully', data: product }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const languages = JSON.parse(req.body.languages)
        const products = await readExcel(req.file.buffer, req.body.fields, languages)

        const data = []

        for (const product of products) {
            const mapName = {}
            languages.forEach(lang => {
                mapName[lang] = product[`NAME_${lang}`.toUpperCase()] || ''
            })

            const brand = await Brand.findById(product.BRAND_ID)
            const category = await Category.findById(product.CATEGORY_ID)
            
            data.push({
                no: product.no,
                _id: product.ID,
                status: product.STATUS,
                currency: product.CURRENCY,
                code: product.CODE,
                price: product.PRICE,
                isStock: product.IS_STOCK,
                brand,
                category,
                description: product.DESCRIPTION,
                tags: product.TAGS || '',
                name: mapName
            })
        }
        response.success(200, { msg: 'List has been previewed', data }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports._export = async (req, res) => {
    try {
        const search = req.query.search?.replace(/ /g,'')
        const field = req.query.field || 'tags'
        const filter = req.query.filter || 'createdAt'
        const sort = req.query.sort || 'desc'
        let filterObj = { [filter]: sort }
        let query = {}
        if (search) {
            query[field] = {
                $regex: new RegExp(search, 'i')
            }
        }
        const products = await Product.find({ isDeleted: false, ...query }).sort(filterObj)

        // Map Excel
        const workbook = new Workbook()
        const worksheet = workbook.addWorksheet(`worksheet`.toUpperCase(), worksheetOption)
        const languages = req.body.languages
        worksheet.columns = [
            { 
                key: 'no', 
                width: 5,  
                style: {
                    alignment: {
                        vertical:'middle',
                        horizontal:'center'
                    }
                }
            },
            { 
                key: 'id', 
                width: 27,
            },
            ...languages.map(lang => ({ 
                key: `name${lang}`, 
                width: 35,
            })),
            { 
                key: 'price', 
                width: 10,
            },
            { 
                key: 'currency', 
                width: 10,
            },
            { 
                key: 'code', 
                width: 30,
            },
            { 
                key: 'isStock', 
                width: 10,
            },
            { 
                key: 'status', 
                width: 10,
            },
            { 
                key: 'description', 
                width: 45,
            }, 
            { 
                key: 'tags', 
                width: 55,
            },
            { 
                key: 'category', 
                width: 27,
            },
            { 
                key: 'brand', 
                width: 27,
            },
        ]
        let headerData = { no: 'NO', id: 'ID', price: 'PRICE', currency: 'CURRENCY', code: 'CODE', isStock: 'IS_STOCK', status: 'STATUS', description: 'DESCRIPTION', tags: 'TAGS', category: 'CATEGORY_ID', brand: 'BRAND_ID' }
        languages.forEach(lang => {
            headerData[`name${lang}`] = `NAME_${lang}`.toUpperCase()
        })
        const header = worksheet.addRow(headerData)
        header.height = 23
        header.eachCell((cell) => {
            cell.style = {
                font: {
                    bold: true,
                    color: { argb: '000000' },
                    size: 11,
                },
                fill:{
                    fgColor: { argb: 'DDDDDD' } ,
                    pattern: 'solid',
                    type: 'pattern' 
                },
                alignment: {
                    vertical:'middle',
                    horizontal:'left'
                }
            }
            if (['no'].includes(cell._column._key)) {
                cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
            }
        })

        // Freeze row
        worksheet.views = [{ state: 'frozen', ySplit: 1 }]

        // Body
        for (const index in products) {
            if (Object.hasOwnProperty.call(products, index)) {
                const product = products[index];
                let rowData = { 
                    no: parseInt(index) + 1, 
                    id: product.id,
                    price: product.price,
                    currency: product.currency,
                    code: product.code,
                    isStock: product.isStock,
                    status: product.status,
                    description: product.description,
                    tags: product.tags,
                    brand: product.brand?.toString(),
                    category: product.category?.toString(),
                }
                languages.forEach(lang => {
                    rowData[`name${lang}`] = product.name[lang] || ''
                })
                worksheet.addRow(rowData)
            }
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=PRODUCT_${now}.xlsx`)

        const file = await workbook.xlsx.writeBuffer()

        return response.success(200, { file, name: `PRODUCT_${now}.xlsx` }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    const products = req.body

    Product.insertMany(products)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'products' : 'product'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}

// CRUD Product Property
exports.createProperty = async (req, res) => {
    const body = req.body
    const { error } = createPropertyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductProperty.create({...body, store: req.store}, (err, property) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Property already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property created!' }, res, err)
            response.success(200, { msg: 'Property has created successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detailProperty = async (req, res) => {
    try {
        const property = await ProductProperty.findOne({ _id: req.params.id, store: req.store })

        return response.success(200, { data: property }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateProperty = async (req, res) => {
    const body = req.body
    const { error } = createPropertyValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductProperty.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, { new: true }, (err, property) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property found for this store!' }, res, err)
            response.success(200, { msg: 'Property has updated successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.reorderProperty = async (req, res) => {
    try {
        await ProductProperty.reorder(req.body, req.store)
        response.success(200, { msg: 'Property has reordered successfully' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableProperty = async (req, res) => {
    try {
        ProductProperty.findOneAndRemove({ _id: req.params.id, store: req.store }, (err, property) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!property) return response.failure(422, { msg: 'No property found for this store!' }, res, err)
            response.success(200, { msg: 'Property has deleted successfully', data: property }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.listProperty = async (req, res) => {
    try {
        const properties = await ProductProperty.find({ isDeleted: false, store: req.store })
            .populate('product', 'name')
            .populate('options')
            .sort({ order: 1 })

        const grouped = {}

        properties.forEach(prop => {
            const productId = prop.product?._id ?? 'unassigned'
            const productName = prop.product?.name || null

            if (!grouped[productId]) {
                grouped[productId] = {
                    _id: productId,
                    product_name: productName,
                    properties: []
                }
            }

            grouped[productId].properties.push(prop)
        })

        return response.success(200, { data: Object.values(grouped) }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.clonePropertyOption = async (req, res) => {
    try {
        const options = Array.isArray(req.body) ? req.body : (req.body.options || [])
        const productId = req.params.id || req.query.id || req.query.productId || req.body.productId

        if (!productId) return response.failure(422, { msg: 'Target product id is required' }, res)
        if (!options?.length) return response.failure(422, { msg: 'No options to clone' }, res)

        const clonedPropertyMap = {}
        const createdOptions = []

        for (const item of options) {
            const sourcePropertyId = item.property
            if (!sourcePropertyId) continue

            // create (or reuse) cloned property for this source property
            let targetPropertyId = clonedPropertyMap[sourcePropertyId]
            if (!targetPropertyId) {
                const sourceProp = await ProductProperty.findOne({ _id: sourcePropertyId, store: req.store })
                if (!sourceProp) continue

                const newPropData = {
                    name: sourceProp.name,
                    order: sourceProp.order || 0,
                    choice: sourceProp.choice,
                    isRequire: sourceProp.isRequire,
                    description: sourceProp.description,
                    product: productId,
                    store: req.store,
                    options: []
                }

                const newProp = await ProductProperty.create(newPropData)
                targetPropertyId = newProp._id
                clonedPropertyMap[sourcePropertyId] = targetPropertyId
            }

            // create option under the cloned property
            const optionData = {
                name: item.name || {},
                price: item.price || 0,
                currency: item.currency || 'USD',
                profile: item.profile || null,
                description: item.description || '',
                isDefault: !!item.isDefault,
                property: targetPropertyId,
                product: productId,
                store: req.store
            }

            const newOption = await ProductOption.create(optionData)
            createdOptions.push(newOption)
        }

        return response.success(200, { msg: `${createdOptions.length} items cloned`, data: createdOptions }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// CRUD Product Option
exports.createOption = async (req, res) => {
    const body = req.body
    const { error } = createOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductOption.create({...body, store: req.store}, (err, option) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Option already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option created!' }, res, err)
            response.success(200, { msg: 'Option has created successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detailOption = async (req, res) => {
    try {
        const option = await ProductOption.findOne({ _id: req.params.id, store: req.store })
            .populate('profile')

        return response.success(200, { data: option }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateOption = async (req, res) => {
    const body = req.body
    const { error } = createOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductOption.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, { new: true }, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option found for this store!' }, res, err)
            response.success(200, { msg: 'Option has updated successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.toggleDefault = async (req, res) => {
    try {
        const id = req.params.id
        const option = await ProductOption.findOne({ _id: id, store: req.store }).populate('property')
        if (!option) return response.failure(422, { msg: 'No option found for this store!' }, res)

        if (option.isDefault) {
            await ProductOption.findOneAndUpdate({ _id: id, store: req.store }, { isDefault: false })
            return response.success(200, { msg: 'Option has updated successfully' }, res)
        }

        if (option?.property?.choice === 'MULTIPLE') {
            await ProductOption.findOneAndUpdate({ _id: id, store: req.store }, { isDefault: true })
            return response.success(200, { msg: 'Option has updated successfully' }, res)
        }

        await ProductOption.updateMany({ property: option.property, store: req.store }, { isDefault: false })
        await ProductOption.findOneAndUpdate({ _id: id, store: req.store }, { isDefault: true })
        return response.success(200, { msg: 'Option has updated successfully' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableOption = async (req, res) => {
    try {
        ProductOption.findOneAndRemove({ _id: req.params.id, store: req.store }, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option found for this store!' }, res, err)
            response.success(200, { msg: 'Option has deleted successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// CRUD Product Color
exports.createColor = async (req, res) => {
    const body = req.body
    const { error } = createColorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductColor.create({...body, store: req.store}, (err, color) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Color already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color created!' }, res, err)
            response.success(200, { msg: 'Color has created successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detailColor = async (req, res) => {
    try {
        const color = await ProductColor.findOne({ _id: req.params.id, store: req.store })
            .populate('profile').populate('images')

        return response.success(200, { data: color }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateColor = async (req, res) => {
    const body = req.body
    const { error } = createColorValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        ProductColor.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, { new: true }, (err, color) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color found for this store!' }, res, err)
            response.success(200, { msg: 'Option has updated successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableColor = async (req, res) => {
    try {
        ProductColor.findOneAndRemove({ _id: req.params.id, store: req.store }, (err, color) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!color) return response.failure(422, { msg: 'No color found for this store!' }, res, err)
            response.success(200, { msg: 'Option has deleted successfully', data: color }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

// CRUD Product Customer
exports.createCustomerOption = async (req, res) => {
    const body = req.body
    const { error } = createCustomerOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        CustomerOption.create({...body, store: req.store}, (err, option) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Option already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option created!' }, res, err)
            response.success(200, { msg: 'Option has created successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detailCustomerOption = async (req, res) => {
    try {
        const option = await CustomerOption.findOne({ _id: req.params.id, store: req.store })

        return response.success(200, { data: option }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.updateCustomerOption = async (req, res) => {
    const body = req.body
    const { error } = createCustomerOptionValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        CustomerOption.findOneAndUpdate({ _id: req.params.id, store: req.store }, body, { new: true }, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option found for this store!' }, res, err)
            response.success(200, { msg: 'Option has updated successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disableCustomerOption = async (req, res) => {
    try {
        CustomerOption.findOneAndRemove({ _id: req.params.id, store: req.store }, (err, option) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!option) return response.failure(422, { msg: 'No option found for this store!' }, res, err)
            response.success(200, { msg: 'Option has deleted successfully', data: option }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
