const response = require('../../helpers/response')
const { createHash, verifyToken, issueToken } = require('../../helpers/utils')

exports.hash = (req, res, next) => {
    const token = req.headers['x-access-token'] || ''
    const hash = req.headers['x-access-hash']
    const timestamp = req.headers['x-access-ts']
    const body = req.body

    if (!hash || !timestamp) return response.failure(411, { msg: 'Missing hash requirement!' }, res)

    try {
        const str = JSON.stringify(body) + process.env.HASH_SECRET + timestamp + token

        const hashed_str = createHash(str)
        if (hashed_str !== hash) return response.failure(400, { msg: 'Hashed body is invalid!' }, res)

        next()
    } catch (err) {
        return response.failure(400, { msg: 'Something went wrong while checking hash!' }, res, err)
    }
}

exports.auth = (req, res, next) => {
    const token = req.headers['x-access-token']
    if (!token) return response.failure(411, { msg: 'Token is required!' }, res)
    verifyToken(token, process.env.TOKEN_SECRET)
        .then(async decoded => {
            const User = require('../../models/User')
            const { id } = decoded
            const user = await User.findById(id).populate('role').populate({ path: 'profile', populate: { path: 'photo' } }).populate('config').populate('drawer')
            req.user = user
            next()
        })
        .catch(err => {
            if (!err.data) return response.failure(401, { msg: 'Token is invalid!' }, res, err)

            const data = err.data
            issueToken(data, process.env.TOKEN_SECRET, 60)
                .then(token => {
                    return response.failure(401, { msg: 'Token is expired!', refresh_token: token }, res)
                })
                .catch(err => {
                    return response.failure(401, { msg: 'Something went wrong while generating refresh token!' }, res, err)
                })
        })
}

exports.self = (req, res, next) => {
    if (req.params?.id !== req.user?.id) return response.failure(422, { msg: 'Request is denied!' }, res)
    next()
}

exports.role = (role) => {
    return (req, res, next) => {
        const user = req.user
        if (!user) return response.failure(401, { msg: 'You don not have permission!' }, res)
        const { route, action } = role
        if (!user.role?.privilege?.[route]?.[action]) return response.failure(401, { msg: 'You don not have permission!' }, res)
        next()
    }
}

exports.audit = () => {
    const Activity = require('../../models/Activity')
    return async (req, res, next) => {
        const user = req.user
        try {
            await Activity.create({ endpoint: req.originalUrl, method: req.method, body: req.body, createdBy: user.id })
            next()
        } catch (err) {
            console.error(err)
        }
    }
}