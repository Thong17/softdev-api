const Category = require('../models/Category')
const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')

exports.menu = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false, status: true })
            .select('name icon products')
            .populate('icon', 'filename')
            .populate({
                path: 'products',
                match: { isDeleted: false, status: true },
                select: 'name price currency description profile images promotion',
                populate: [
                    { path: 'profile', select: 'filename' },
                    { path: 'images', select: 'filename' },
                    { path: 'promotion', select: 'description isFixed startAt expireAt type value' },
                ]
            })

        return response.success(200, { data: categories }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
