const mongoose = require('mongoose')
const Roles = require('./Roles')
const { encryptPassword, comparePassword, issueToken } = require('../helpers/utils')

const schema = mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required!']
        },
        email: {
            type: String,
            required: [true, 'Email is required!'],
            index: {
                unique: true
            }
        },
        password: {
            type: String,
            required: [true, 'Password is required!'],
            minlength: [7, 'Password must be at least 7 characters!'],
            validate: {
                validator: (password) => {
                    return new Promise((resolve, reject) => {
                        try {
                            let passwordComplexity = new RegExp('(?=.*[a-z])(?=.*[0-9])(?=.{7,})')
                            resolve(passwordComplexity.test(password))
                        } catch (err) {
                            reject(err)
                        }
                    })
                },
                message: 'Strong password is required!'
            },
        },
        role: {
            type: mongoose.Schema.ObjectId,
            ref: 'Roles',
            required: [true, 'Role is required!'],
            validate: {
                validator: (id) => {
                    return new Promise((resolve, reject) => {
                        Roles.findById(id, function (err, doc) {
                            if (err) return reject(err)
                            resolve(!!doc)
                        })
                    })
                },
                message: 'Role is not existed in our system'
            },
        },
        isDisabled: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.pre('save', async function () {
    this.password = await encryptPassword(this.password)
    return this
})

schema.statics.authenticate = function (email, password, cb) {
    this.findOne({ email, isDisabled: { $ne: true } })
        .populate('role')
        .then(user => {
            if (!user) return cb({ code: 404, msg: 'Email or password is incorrect' }, null)
            comparePassword(password, user.password)
                .then(isMatch => {
                    if (!isMatch) return cb({ code: 404, msg: 'Email or password is incorrect' }, null)
                    issueToken({ id: user.id, username: user.username, role: user.role?.privilege }, process.env.TOKEN_SECRET, '1d')
                        .then(token => {
                            cb(null, token)
                        })
                        .catch(err => {
                            cb({ code: 422, msg: err.message }, null)
                        })
                })
                .catch(err => {
                    cb({ code: 422, msg: err.message }, null)
                })
        })
        .catch(err => {
            cb({ code: 422, msg: err.message }, null)
        })
}

module.exports = mongoose.model('Users', schema)