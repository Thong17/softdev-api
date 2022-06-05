const response = require('../helpers/response')
const Image = require('../models/Image')
const { failureMsg } = require('../constants/responseMsg')

exports.uploadImage = (req, res) => {
    try {
        Image.create({ filename: req.file.filename }, (err, image) => {
            if (err) {
                return response.failure(422, { msg: err.message }, res, err)
            }

            if (!image) return response.failure(422, { msg: 'No image uploaded!' }, res, err)
            response.success(200, { msg: 'Image has uploaded successfully', data: image }, res)
        })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
