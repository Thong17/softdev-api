const Loan = require('../models/Loan')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads')
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`)
    },
})
const uploadFiles = multer({
    storage,
    limits: { fileSize: 10 * 1000 * 1000 },
  }).array('attachment', 10)

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
    
    Loan.find({ isDeleted: false, ...query }, async (err, loans) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

        const totalCount = await Loan.count({ isDeleted: false })
        return response.success(200, { data: loans, length: totalCount }, res)
    })
        .skip(page * limit).limit(limit)
        .sort(filterObj)
        .populate('icon')
}

exports.detail = async (req, res) => {
    Loan.findById(req.params.id, (err, loan) => {
        if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)
        return response.success(200, { data: loan }, res)
    }).populate('icon')
}

exports.create = async (req, res) => {
    uploadFiles(req, res, (err) => {
        if (err) return response.failure(422, { msg: err.message }, res, err)
        const body = {}
        Object.keys(req.body).forEach(item => {
            if (item === 'attachment') return
            body[item] = JSON.parse(req.body[item])
        })
        const files = req.files.map(file => ({ filename: file.filename }))
        try {
            Loan.create({...body, attachments: files, createdBy: req.user.id}, (err, loan) => {
                if (err) {
                    switch (err.code) {
                        case 11000:
                            return response.failure(422, { msg: 'Loan already exists!' }, res, err)
                        default:
                            return response.failure(422, { msg: err.message }, res, err)
                    }
                }

                if (!loan) return response.failure(422, { msg: 'No loan created!' }, res, err)
                response.success(200, { msg: 'Loan has created successfully', data: loan }, res)
            })
        } catch (err) {
            return response.failure(422, { msg: failureMsg.trouble }, res, err)
        }
    })
    
}
