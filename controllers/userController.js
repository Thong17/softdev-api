const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const Config = require('../models/Config')

exports.profile = (req, res) => {
    const user = {
        id: req.user.id,
        username: req.user.username,
        privilege: req.user.role.privilege,
        photo: req.user.profile?.photo,
        theme: req.user.config?.theme,
        language: req.user.config?.language
    }
    return response.success(200, { user }, res)
}

exports.changeTheme = async (req, res) => {
    try {
        const config = await Config.findById(req.user.config)
        config.theme = req.body.theme
        await config.save()
        return response.success(200, { theme: config.theme }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.changeLanguage = async (req, res) => {
    try {
        const config = await Config.findById(req.user.config)
        config.language = req.body.language
        await config.save()
        return response.success(200, { language: config.language }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}