const response = require('../helpers/response')
const Config = require('../models/Config')
const User = require('../models/User')
const Profile = require('../models/Profile')
const StoreMember = require('../models/StoreMember')
const { failureMsg } = require('../constants/responseMsg')
const { extractJoiErrors, readExcel, encryptPassword, comparePassword, validatePassword, generateSecurePassword } = require('../helpers/utils')
const { createUserValidation, updateUserValidation } = require('../middleware/validations/userValidation')

exports.index = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10
    const page = parseInt(req.query.page) || 0
    const search = req.query.search?.replace(/ /g,'')
    const field = req.query.field || 'tags'
    const filter = req.query.filter || 'createdAt'
    const sort = req.query.sort || 'asc'

    let filterObj = { [filter]: sort }
    let userQuery = {}
    if (search) {
        userQuery[field] = {
            $regex: new RegExp(search, 'i')
        }
    }

    try {
        const memberIds = await StoreMember.find({ store: req.store, isDisabled: false }).distinct('user')
        const query = { isDisabled: false, _id: { $in: memberIds }, ...userQuery }

        User.find(query, async (err, users) => {
            if (err) return response.failure(422, { msg: failureMsg.trouble }, res, err)

            const totalCount = await User.count(query)
            const memberships = await StoreMember.find({ store: req.store, user: { $in: users.map(u => u.id) } }).populate('role', 'name')
            const data = users.map(user => ({
                ...user.toObject(),
                role: memberships.find(m => m.user.toString() === user.id)?.role
            }))
            return response.success(200, { data, length: totalCount }, res)
        })
            .skip(page * limit).limit(limit)
            .sort(filterObj)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.detail = async (req, res) => {
    try {
        const member = await StoreMember.findOne({ store: req.store, user: req.params.id }).populate('role')
        if (!member) return response.failure(404, { msg: 'This user is not a member of the current store!' }, res)

        const user = await User.findById(req.params.id)
        return response.success(200, { data: { ...user.toObject(), role: member.role } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.profileDetail = async (req, res) => {
    const user = await User.findById(req.params.id).select('username email').populate({ path: 'profile', populate: { path: 'photo', select: 'filename' } })
    return response.success(200, { data: user }, res)
}

exports.passwordUpdate = async (req, res) => {
    try {
        const { current_password, new_password } = req.body
        const id = req.params.id
        const user = await User.findById(id).select('+password')
        comparePassword(current_password, user.password)
            .then(async isMatch => {
                if (!isMatch) return response.failure(422, { msg: 'Password is incorrect' }, res)
                const password = await encryptPassword(new_password)
                await User.findByIdAndUpdate(id, { password, mustChangePassword: false })
                return response.success(200, { msg: 'Password has updated successfully' }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res, err)
            })
    } catch (err) {
        return response.failure(422, { msg: err.message }, res, err)
    }
}

exports.profileUpdate = async (req, res) => {
    const userData = {
        username: req.body.username,
        email: req.body.email
    }
    const profileData = {
        photo: req.body.photo,
        gender: req.body.gender,
        birthday: req.body.birthday,
        contact: req.body.contact,
        address: req.body.address,
    }
    const user = await User.findByIdAndUpdate(req.params.id, userData).select('profile')
    await Profile.findByIdAndUpdate(user?.profile, profileData)
    return response.success(200, { msg: 'Profile has updated successfully' }, res)
}

exports.create = async (req, res) => {
    const body = req.body
    const { error } = createUserValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const { role, username, ...userBody } = body

        let user = await User.findOne({ username })
        if (user) {
            const existingMember = await StoreMember.findOne({ store: req.store, user: user.id })
            if (existingMember) return response.failure(422, { msg: 'This user is already a member of this store!' }, res)

            await StoreMember.create({ store: req.store, user: user.id, role, createdBy: req.user.id })
            return response.success(200, { msg: 'Existing user has been added to this store successfully', data: user }, res)
        }

        const password = await encryptPassword(body.password)
        user = await User.create({ ...userBody, username, password, createdBy: req.user.id })
        await StoreMember.create({ store: req.store, user: user.id, role, createdBy: req.user.id })
        response.success(200, { msg: 'User has created successfully', data: user }, res)
    } catch (err) {
        switch (err.code) {
            case 11000:
                return response.failure(422, { msg: 'User already exists!' }, res, err)
            default:
                return response.failure(422, { msg: err.message || failureMsg.trouble }, res, err)
        }
    }
}

exports.update = async (req, res) => {
    const id = req.params.id
    const body = req.body
    const { error } = updateUserValidation.validate(body, { abortEarly: false })
    if (error) return response.failure(422, extractJoiErrors(error), res)

    try {
        const { role, ...userBody } = body
        if (userBody.password !== '') {
            if (userBody.password.length < 7) return response.failure(422, { msg: 'Password must be at least 7 characters!' }, res)
            if (!validatePassword(userBody.password)) return response.failure(422, { msg: 'Strong password is required!' }, res)
            userBody.password = await encryptPassword(userBody.password)
        } else {
            delete userBody.password
        }

        const user = await User.findByIdAndUpdate(id, userBody, { new: true })
        if (!user) return response.failure(422, { msg: 'No user updated!' }, res)

        await StoreMember.findOneAndUpdate({ store: req.store, user: id }, { role }, { upsert: true, setDefaultsOnInsert: true })
        response.success(200, { msg: 'User has updated successfully', data: user }, res)
    } catch (err) {
        return response.failure(422, { msg: err.message || failureMsg.trouble }, res, err)
    }
}

exports.disable = async (req, res) => {
    const id = req.params.id
    try {
        const user = await User.findById(id)
        if (user?.isDefault) return response.failure(422, { msg: 'Default user cannot be delete' }, res)

        const member = await StoreMember.findOneAndUpdate({ store: req.store, user: id }, { isDisabled: true })
        if (!member) return response.failure(422, { msg: 'This user is not a member of the current store!' }, res)

        response.success(200, { msg: 'User has been removed from this store successfully', data: id }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports._import = async (req, res) => {
    try {
        const users = await readExcel(req.file.buffer, req.body.fields)
        response.success(200, { msg: 'List has been previewed', data: users }, res)
    } catch (err) {
        return response.failure(err.code, { msg: err.msg }, res)
    }
}

exports.batch = async (req, res) => {
    try {
        const users = req.body
        const credentials = []

        for (const user of users) {
            const plainPassword = generateSecurePassword()
            user.password = await encryptPassword(plainPassword)
            user.mustChangePassword = true
            credentials.push({ username: user.username, password: plainPassword })
        }

        User.insertMany(users)
            .then(data => {
                response.success(200, {
                    msg: `${data.length} ${data.length > 1 ? 'users' : 'user'} has been inserted`,
                    credentials
                }, res)
            })
            .catch(err => {
                return response.failure(422, { msg: err.message }, res)
            })
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res)
    }
}

exports.profile = async (req, res) => {
    const memberships = await StoreMember.find({ user: req.user?.id, isDisabled: false }).populate('store').populate('role')
    const stores = memberships.map(member => ({
        id: member.store?.id,
        name: member.store?.name,
        logo: member.store?.logo,
        roleName: member.role?.name,
        isDefault: member.isDefault
    }))

    const user = {
        id: req.user?.id,
        username: req.user?.username,
        privilege: req.privilege,
        photo: req.user?.profile?.photo?.filename,
        theme: req.user?.config?.theme,
        language: req.user?.config?.language,
        favorites: req.user?.favorites,
        drawer: req.user?.drawer,
        isDefault: req.user?.isDefault,
        mustChangePassword: req.user?.mustChangePassword,
        stores,
        activeStoreId: req.store || null
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

exports.addFavorite = async (req, res) => {
    try {
        const productId = req.params.id
        const user = await User.findById(req.user?.id)
        user.favorites.push(productId)
        await user.save()
        return response.success(200, { msg: 'An item has been added to favorite' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.removeFavorite = async (req, res) => {
    try {
        const productId = req.params.id
        const user = await User.findById(req.user?.id)
        user.favorites = user.favorites.filter(id => !id.equals(productId))
        await user.save()
        return response.success(200, { msg: 'An item has been removed from favorite' }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}
