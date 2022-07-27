const mongoose = require('mongoose')
const Role = require('./Role')
const Profile = require('./Profile')
const Config = require('./Config')
const { encryptPassword, comparePassword, issueToken } = require('../helpers/utils')

const schema = mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required!'],
            index: {
                unique: true
            }
        },
        email: {
            type: String,
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
            ref: 'Role',
            required: [true, 'Role is required!'],
            validate: {
                validator: (id) => {
                    return new Promise((resolve, reject) => {
                        Role.findById(id, function (err, doc) {
                            if (err) return reject(err)
                            resolve(!!doc)
                        })
                    })
                },
                message: 'Role is not existed in our system'
            },
        },
        profile: {
            type: mongoose.Schema.ObjectId,
            ref: 'Profile'
        },
        config: {
            type: mongoose.Schema.ObjectId,
            ref: 'Config'
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        isDisabled: {
            type: Boolean,
            default: false
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        tags: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

schema.pre('save', async function (next) {
    try {
        this.tags = `${this.username}${this.email || ''}`.replace(/ /g,'')
        this.password = await encryptPassword(this.password)
        next()
    } catch (err) {
        next(err)
    }
})

schema.post('save', async function () {
    if (!this.profile) {
        const profile = await Profile.create({})
        await this.model('User').findOneAndUpdate({ _id: this.id }, { profile: profile.id })
    }
    if (!this.config) {
        const config = await Config.create({})
        await this.model('User').findOneAndUpdate({ _id: this.id }, { config: config.id })
    }
})

schema.post('insertMany', async function(users) {
    users.forEach(async user => {
        if (!user.profile) {
            const profile = await Profile.create({})
            await this.model('User').findOneAndUpdate({ _id: user.id }, { profile: profile.id })
        }
        if (!user.config) {
            const config = await Config.create({})
            await this.model('User').findOneAndUpdate({ _id: user.id }, { config: config.id })
        }
    })
})

schema.statics.authenticate = function (username, password, cb) {
    this.findOne({ username, isDisabled: { $ne: true } })
        .populate('role')
        .populate('profile')
        .populate('config')
        .then(user => {
            if (!user) return cb({ code: 404, msg: 'Username is incorrect' }, null)
            comparePassword(password, user.password)
                .then(isMatch => {
                    if (!isMatch) return cb({ code: 404, msg: 'Password is incorrect' }, null)
                    issueToken({ id: user.id }, process.env.TOKEN_SECRET, '1d')
                        .then(token => {
                            cb(null, { token, user })
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

module.exports = mongoose.model('User', schema)