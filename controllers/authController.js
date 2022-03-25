const { encryptPassword, comparePassword, extractJoiErrors, issueToken } = require('../helpers/utils')
const response = require('../helpers/response')
const { loginValidation, signUpValidation } = require('../middleware/validations/authValidation')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

exports.login = async (req, res) => {
    const body = req.body
    const { error } = loginValidation.validate(body, { abortEarly: false })
    if (error) { return res.json(extractJoiErrors(error)) }

    try {
        // Sign In 
        const user = await prisma.user.findFirst({ where: { username: body.username } })
        if (!user) return response.failure(404, 'Invalid username or password!', res)
        comparePassword(body.password, user.password)
            .then(isMatch => {
                if (!isMatch) return response.failure(404, 'Invalid username or password!', res)
                return response.success({ accessToken: issueToken({ username: user.username }, 60) }, res)
            })
            .catch(error => {
                console.log(error)
                return response.failure(404, 'Invalid username or password!', res)
            }) 
    } catch (error) {
        console.log(error)
        return response.failure(422, 'Trouble while collecting data!', res)
    }
}

exports.signup = async (req, res) => {
    const body = req.body
    const { error } = signUpValidation.validate(body, { abortEarly: false })
    if (error) { return response.failure(422, extractJoiErrors(error), res) }

    try {
        // Sign Up
        delete body.confirm_password
        body.password = await encryptPassword(body.password)

        const user = await prisma.user.create({ data: body })
        await prisma.profile.create({ data: { userId: user.id }})

        response.success(user, res)
    } catch (error) {
        console.log(error)
        if (error.code === 'P2002') return response.failure(422, 'Input data already exist!', res)
        return response.failure(422, 'Trouble while collecting data!', res)
    }
}
