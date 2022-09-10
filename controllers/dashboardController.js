const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const Role = require('../models/Role')
const User = require('../models/User')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const Product = require('../models/Product')
const StoreFloor = require('../models/StoreFloor')
const StoreStructure = require('../models/StoreStructure')

exports.admin = async (req, res) => {
    try {
        const totalRole = await Role.count({ isDisabled: false })
        const totalUser = await User.count({ isDisabled: false })
        const roles = await Role.find({ isDisabled: false }).select('name privilege')
        let totalPrivilege
        const roleData = []
        roles.forEach((role) => {
            let privilege = 0
            totalPrivilege = 0
            Object.keys(role.privilege)?.forEach((route) => {
                Object.keys(role.privilege?.[route])?.forEach((action) => {
                    if (role.privilege?.[route]?.[action]) privilege += 1
                    totalPrivilege += 1
                })
            })
            let obj = {
                id: role._id,
                name: role.name,
                value: privilege,
                title: 'Assigned',
                detail: totalPrivilege
            }
            roleData.push(obj)
        })

        const users = await User.find({ isDisabled: false }).select('role')
        const userData = []
        roleData.forEach((role) => {
            let userObj = {
                name: role.name,
                value: 0,
                title: 'User',
                detail: role.value
            }
            users.forEach((user) => {
                if (user.role.equals(role.id)) userObj.value += 1
            })
            userData.push(userObj)
        })

        return response.success(200, { data: { totalRole, totalUser, totalPrivilege, roles: roleData, users: userData } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}

exports.organize = async (req, res) => {
    try {
        const totalCategory = await Category.count({ isDeleted: false })
        const totalBrand = await Brand.count({ isDeleted: false })
        const totalFloor = await StoreFloor.count({ isDisabled: false })
        const totalProduct = await Product.count({ isDeleted: false })
        const totalStructure = await StoreStructure.count({ isDisabled: false })

        const categories = await Category.find({ isDeleted: false }).select('name products')
        const categoryData = []
        categories.forEach((item) => {
            let obj = {
                id: item._id,
                name: item.name,
                value: item.products.length,
                title: 'Product',
                detail: item.products.length
            }
            categoryData.push(obj)
        })

        const brands = await Brand.find({ isDeleted: false }).select('name products')
        const brandData = []
        brands.forEach((item) => {
            let obj = {
                id: item._id,
                name: item.name,
                value: item.products.length,
                title: 'Product',
                detail: item.products.length
            }
            brandData.push(obj)
        })

        const products = await Product.find({ isDeleted: false }).select('name isStock')
        let totalWithStock = 0 
        let totalWithoutStock = 0
        products.forEach((item) => {
            if (item.isStock) return totalWithStock += 1
            else return totalWithoutStock += 1
        })
        let withStockObj = {
            id: 'withStock',
            name: 'Is Stock',
            value: totalWithStock,
            title: 'Product',
            detail: 'Is Stock'
        }
        let withoutStockObj = {
            id: 'withoutStock',
            name: 'Not Stock',
            value: totalWithoutStock,
            title: 'Product',
            detail: 'Not Stock'
        }
        const productDate = [withStockObj, withoutStockObj]

        const floors = await StoreFloor.find({ isDisabled: false }).select('floor structures')
        const floorData = []
        floors.forEach((item) => {
            let obj = {
                id: item._id,
                name: item.name,
                value: item.structures.length,
                title: 'Structure',
                detail: item.structures.length
            }
            floorData.push(obj)
        })

        return response.success(200, { data: { totalCategory, totalBrand, totalProduct, totalFloor, totalStructure, categories: categoryData, brands: brandData, products: productDate, floors: floorData } }, res)
    } catch (err) {
        return response.failure(422, { msg: failureMsg.trouble }, res, err)
    }
}