const Customer = require('../models/Customer')
const Image = require('../models/Image')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel } = require('../helpers/utils')
const { createCustomerValidation } = require('../middleware/validations/customerValidation')


exports.list = async (req, res) => {
    const limit = parseInt(req.query.limit)
    const offset = parseInt(req.query.offset) || 0
    const search = req.query.search?.replace(/ /g,'')
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

    Customer.find({ isDeleted: false, isDisabled: false, ...query }, async (err, customers) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        const totalCount = await Customer.count({ isDeleted: false, isDisabled: false, ...query  }) 
        let hasMore = totalCount > offset + limit
        if (search !== '' || brand !== 'all' || category !== 'all' || promotion || favorite || promotions) hasMore = true

        return response.success(200, { data: customers, length: totalCount, hasMore }, res)
    })  
        .skip(offset).limit(limit)
        .sort(filterObj)
        .populate('picture', 'filename')
}

exports.detail = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)

        return response.success(200, { data: customer }, res)
    } catch (err) {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }   
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createCustomerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Customer.create({...body, createdBy: req.user.id}, async (err, customer) => {
            if (err) {
                switch (err.code) {
                    case 11000:
                        return response.failure(422, { msg: 'Customer already exists!' }, res, err)
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer created!' }, res, err)

            await Image.updateMany({ _id: { $in: customer.images } }, { $set: { isActive: true } }, { multi:true })
            response.success(200, { msg: 'Customer has created successfully', data: customer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.update = async (req, res) => {
    const body = req.body
    const { error } = createCustomerValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        Customer.findByIdAndUpdate(req.params.id, body, (err, customer) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer updated!' }, res, err)
            response.success(200, { msg: 'Customer has updated successfully', data: customer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    try {
        Customer.findByIdAndUpdate(req.params.id, { isDeleted: true }, (err, customer) => {
            if (err) {
                switch (err.code) {
                    default:
                        return response.failure(422, { msg: err.message }, res, err)
                }
            }

            if (!customer) return response.failure(422, { msg: 'No customer deleted!' }, res, err)
            response.success(200, { msg: 'Customer has deleted successfully', data: customer }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const customers = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: customers }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    const customers = req.body

    customers.forEach(customer => {
        customer.name = JSON.parse(customer.name)
        customer.images = JSON.parse(customer.images || '[]')
        customer.options = JSON.parse(customer.options || '[]')
        customer.properties = JSON.parse(customer.properties || '[]')
        customer.colors = JSON.parse(customer.colors || '[]')
    })

    Customer.insertMany(customers)
        .then(data => {
            response.success(200, { msg: `${data.length} ${data.length > 1 ? 'customers' : 'customer'} has been inserted` }, res)
        })
        .catch(err => {
            return response.failure(422, { msg: err.message }, res)
        })
}