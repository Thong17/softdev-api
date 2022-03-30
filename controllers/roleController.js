const Roles = require('../models/Roles')
const response = require('../helpers/response')

exports.index = async (req, res) => {
    return response.success(200, { data: 'success' }, res)
}