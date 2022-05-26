const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

module.exports = utils = {
    encryptPassword: (plainPassword) => {
        return bcrypt.hash(plainPassword, 10)
    },
    comparePassword: (plainPassword, encryptedPassword) => {
        return bcrypt.compare(plainPassword, encryptedPassword)
    },
    extractJoiErrors: (error) => {
        const messages = []
        error.details?.forEach(error => {
            const obj = {
                path: error.message,
                key: error.context.label
            }
            messages.push(obj)
        });
        return messages
    },
    issueToken: (data, secret, expire) => {
        return new Promise((resolve, reject) => {
            try {
                const token = jwt.sign(data, secret, { expiresIn: expire })
                resolve(token)
            } catch (err) {
                reject(err)
            }
        })
    },
    verifyToken: (token, secret) => {
        return new Promise((resolve, reject) => {
            try {
                const decoded = jwt.verify(token, secret)
                resolve(decoded)
            } catch (err) {
                if (err.name !== 'TokenExpiredError') reject(err)
                const decoded = jwt.decode(token, secret)
                reject(decoded)
            }
        })
    },
    createHash: (str) => {
        const sha256 = require('js-sha256')
        return sha256.hex(str).toString()
    }
}