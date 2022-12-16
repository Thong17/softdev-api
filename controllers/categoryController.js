const Category = require('../models/Category')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createCategoryValidation } = require('../middleware/validations/categoryValidation')
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

    Category.find({ isDeleted: false, ...query }, async (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Category.count({ isDeleted: false })
        return response.success(200, { data: categories, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('icon')
}

exports.list = async (req, res) => {
    Category.find({ isDeleted: false, status: true }, (err, categories) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: categories }, res)
    }).select('name tags icon').populate('icon')
}

exports.detail = async (req, res) => {
    Category.findById(req.params.id, (err, category) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: category }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createCategoryValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Category.create({...body, createdBy: req.user.id}, (err, category) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Category already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category created!' }, res, err)
            response.success(200, { msg: 'Category has created successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createCategoryValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Category.findByIdAndUpdate(req.params.id, body, (err, category) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category updated!' }, res, err)
            response.success(200, { msg: 'Category has updated successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.toggleStatus = async (req, res) => {
    try {
        const id = req.params.id
        const category = await Category.findById(id)
        Category.findByIdAndUpdate(id, { status: !category.status }, { new: true }, async (err, category) => {
            if (err) return response.failure(422, { msg: err.message }, res, err)

            const data = await category.populate('icon')
            if (!category) return response.failure(422, { msg: 'No category updated!' }, res, err)
            response.success(200, { msg: 'Category has updated successfully', data }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Category.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, category) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!category) return response.failure(422, { msg: 'No category deleted!' }, res, err)
            response.success(200, { msg: 'Category has deleted successfully', data: category }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const languages = JSON.parse(req.body.languages)
        const categories = await readExcel(req.file.buffer, req.body.fields, languages)

        const data = []
        categories.forEach(category => {
            const mapName = {}
            languages.forEach(lang => {
                mapName[lang] = category[`NAME_${lang}`.toUpperCase()] || ''
            })
            data.push({
                no: category.no,
                _id: category.ID,
                status: category.STATUS,
                description: category.DESCRIPTION,
                tags: category.TAGS || '',
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
        const categories = await Category.find({ isDeleted: false, ...query }).sort(filterObj)

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
        for (const index in categories) {
            if (Object.hasOwnProperty.call(categories, index)) {
                const category = categories[index];
                let rowData = { 
                    no: parseInt(index) + 1, 
                    id: category.id,
                    status: category.status,
                    description: category.description,
                    tags: category.tags,
                }
                languages.forEach(lang => {
                    rowData[`name${lang}`] = category.name[lang] || ''
                })
                worksheet.addRow(rowData)
            }
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=CATEGORY_${now}.xlsx`)

        const file = await workbook.xlsx.writeBuffer()

        return response.success(200, { file, name: `CATEGORY_${now}.xlsx` }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const categories = req.body

        Category.insertMany(categories)
            .then(data => {
                response.success(200, { msg: `${data.length} ${data.length > 1 ? 'categories' : 'category'} has been inserted` }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

