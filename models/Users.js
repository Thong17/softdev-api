const mongoose = require('mongoose')
const Role = require('./Role')
const Branch = require('./Branch')
const bcrypt = require('bcrypt')
const MakerChecker = require('./MakerChecker')
const moment = require('moment');

require('../helpers/mongoose-paginate')

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
            minlength: [7, 'Password must be atleast 7 characters!'],
            validate: {
                validator: (val) => {
                    return new Promise((resolve, reject) => {
                        // if match simple pattern, false
                        let passwordComplexity = new RegExp('(?=.*[a-z])(?=.*[0-9])(?=.{7,})')
                        resolve(passwordComplexity.test(val))
                    })
                },
                message: 'Strong password is required!'
            },
        },
        role: {
            type: mongoose.Schema.ObjectId,
            ref: 'Roles',
            required: function () {
                return this.email !== 'admin@admin.com'
            },
            validate: {
                validator: (val) => {
                    return new Promise((resolve, reject) => {
                        Roles.findById(val, function (err, doc) {
                            resolve(!!doc)
                        });
                    })
                },
                message: 'Role is not existed in our system!'
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


module.exports = mongoose.model('Users', schema)