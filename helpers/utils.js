module.exports = utils = {
    encryptPassword: (plainPassword) => {
        const bcrypt = require('bcrypt')
        return bcrypt.hash(plainPassword, 10)
    },
    comparePassword: (plainPassword, encryptedPassword) => {
        const bcrypt = require('bcrypt')
        return bcrypt.compare(plainPassword, encryptedPassword)
    },
    extractJoiErrors: (error) => {
        const messages = []
        error.details.forEach(error => {
            const obj = {
                path: error.message,
                key: error.context.label
            }
            messages.push(obj)
        });
        return messages
    },
    issueToken: (data, expire) => {
        require('dotenv').config()
        const jwt = require('jsonwebtoken')
        return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: expire })
    }
}