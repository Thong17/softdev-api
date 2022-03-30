const mongoose = require('mongoose')

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