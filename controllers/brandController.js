const Brand = require('../models/Brand')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createBrandValidation } = require('../middleware/validations/brandValidation')
const { Workbook } = require('exceljs')
const { worksheetOption } = require('../configs/excel')
const moment = require('moment')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
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
    
    Brand.find({ isDeleted: false, ...query }, async (err, brands) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Brand.count({ isDeleted: false })
        return response.success(200, { data: brands, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('icon')
}

exports.list = async (req, res) => {
    Brand.find({ isDeleted: false, status: true }, (err, brands) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: brands }, res)
    }).select('name tags icon').populate('icon')
}

exports.detail = async (req, res) => {
    Brand.findById(req.params.id, (err, brand) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: brand }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createBrandValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Brand.create({...body, createdBy: req.user.id}, (err, brand) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Brand already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand created!' }, res, err)
            response.success(200, { msg: 'Brand has created successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createBrandValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Brand.findByIdAndUpdate(req.params.id, body, (err, brand) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand updated!' }, res, err)
            response.success(200, { msg: 'Brand has updated successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.toggleStatus = async (req, res) => {
    try {
        const id = req.params.id
        const brand = await Brand.findById(id)
        Brand.findByIdAndUpdate(id, { status: !brand.status }, { new: true }, async (err, brand) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            const data = await brand.populate('icon')
            if (!brand) return response.failure(422, { msg: 'No brand updated!' }, res, err)
            response.success(200, { msg: 'Brand has updated successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Brand.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, brand) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!brand) return response.failure(422, { msg: 'No brand deleted!' }, res, err)
            response.success(200, { msg: 'Brand has deleted successfully', data: brand }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const languages = JSON.parse(req.body.languages)
        const brands = await readExcel(req.file.buffer, req.body.fields, languages)

        const data = []
        brands.forEach(brand => {
            const mapName = {}
            languages.forEach(lang => {
                mapName[lang] = brand[`NAME_${lang}`.toUpperCase()] || ''
            })
            data.push({
                no: brand.no,
                _id: brand.ID,
                status: brand.STATUS,
                description: brand.DESCRIPTION,
                tags: brand.TAGS || '',
                name: mapName
            }) 
        })

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
        const brands = await Brand.find({ isDeleted: false, ...query }).sort(filterObj)

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
        ]
        let headerData = { no: 'NO', id: 'ID', status: 'STATUS', description: 'DESCRIPTION', tags: 'TAGS' }
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
        for (const index in brands) {
            if (Object.hasOwnProperty.call(brands, index)) {
                const brand = brands[index];
                let rowData = { 
                    no: parseInt(index) + 1, 
                    id: brand.id,
                    status: brand.status,
                    description: brand.description,
                    tags: brand.tags,
                }
                languages.forEach(lang => {
                    rowData[`name${lang}`] = brand.name[lang] || ''
                })
                worksheet.addRow(rowData)
            }
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=BRAND_${now}.xlsx`)

        const file = await workbook.xlsx.writeBuffer()

        return response.success(200, { file, name: `BRAND_${now}.xlsx` }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const brands = req.body

        Brand.insertMany(brands)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'branches' : 'branch'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

