const response = require('../helpers/response')
const Icon = require('../models/Icon')
const Image = require('../models/Image')
const { failureMsg } = require('../constants/responseMsg')

exports.uploadImageController = (req, res) => {
    const files = req.files.map(file => {
        return { filename: file.filename }
    })
    try {
        Image.insertMany(files, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No image uploaded!' }, res, err)
            response.success(200, { msg: 'Images has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.uploadIconController = (req, res) => {
    try {
        Icon.create({ filename: req.file.filename }, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No icon uploaded!' }, res, err)
            response.success(200, { msg: 'Icon has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
