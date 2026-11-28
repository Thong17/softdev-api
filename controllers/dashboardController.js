const response = require('../helpers/response')
const { failureMsg } = require('../constants/responseMsg')
const Role = require('../models/Role')
const User = require('../models/User')
const Brand = require('../models/Brand')
const Category = require('../models/Category')
const Product = require('../models/Product')
const StoreFloor = require('../models/StoreFloor')
const StoreStructure = require('../models/StoreStructure')
const ProductStock = require('../models/ProductStock')
const Transaction = require('../models/Transaction')
const Reservation = require('../models/Reservation')
const Promotion = require('../models/Promotion')
const { compareDate } = require('../helpers/utils')
const Customer = require('../models/Customer')
const CustomerTier = require('../models/CustomerTier')
const Announcement = require('../models/Announcement')
const Payment = require('../models/Payment')

exports.admin = async (req, res) => {
  try {
    const totalRole = await Role.count({ isDisabled: false })
    const totalUser = await User.count({ isDisabled: false })
    const roles = await Role.find({ isDisabled: false }).select(
      'name privilege'
    )
    let totalPrivilege
    const roleData = []
    roles.forEach((role) => {
      let privilege = 0
      totalPrivilege = 0
      Object.keys(role.privilege || {})?.forEach((route) => {
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
        detail: totalPrivilege,
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
        detail: role.value,
      }
      users.forEach((user) => {
        if (user.role.equals(role.id)) userObj.value += 1
      })
      userData.push(userObj)
    })

    return response.success(
      200,
      {
        data: {
          totalRole,
          totalUser,
          totalPrivilege,
          roles: roleData,
          users: userData,
        },
      },
      res
    )
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
    const totalStandardStructure = await StoreStructure.count({ isDisabled: false, merged: null })
    const totalMergedStructure = await StoreStructure.count({ isDisabled: false, merged: true, isMain: true })

    const categories = await Category.find({ isDeleted: false }).select(
      'name products'
    )
    const categoryData = []
    categories.forEach((item) => {
      let obj = {
        id: item._id,
        name: item.name,
        value: item.products.length,
        title: 'Product',
        detail: item.products.length,
      }
      categoryData.push(obj)
    })

    const brands = await Brand.find({ isDeleted: false }).select(
      'name products'
    )
    const brandData = []
    brands.forEach((item) => {
      let obj = {
        id: item._id,
        name: item.name,
        value: item.products.length,
        title: 'Product',
        detail: item.products.length,
      }
      brandData.push(obj)
    })

    const products = await Product.find({ isDeleted: false }).select(
      'name isStock'
    )
    let totalWithStock = 0
    let totalWithoutStock = 0
    products.forEach((item) => {
      if (item.isStock) return (totalWithStock += 1)
      else return (totalWithoutStock += 1)
    })
    let withStockObj = {
      id: 'withStock',
      name: 'Is Stock',
      value: totalWithStock,
      title: 'Product',
      detail: 'Is Stock',
    }
    let withoutStockObj = {
      id: 'withoutStock',
      name: 'Not Stock',
      value: totalWithoutStock,
      title: 'Product',
      detail: 'Not Stock',
    }
    const productDate = [withStockObj, withoutStockObj]

    const floors = await StoreFloor.find({ isDisabled: false }).select(
      'floor structures'
    )
    const floorData = []
    floors.forEach((item) => {
      let obj = {
        id: item._id,
        name: item.name,
        value: item.structures.length,
        title: 'Structure',
        detail: item.structures.length,
      }
      floorData.push(obj)
    })

    return response.success(
      200,
      {
        data: {
          totalCategory,
          totalBrand,
          totalProduct,
          totalFloor,
          totalStructure: totalStandardStructure + totalMergedStructure,
          categories: categoryData,
          brands: brandData,
          products: productDate,
          floors: floorData,
        },
      },
      res
    )
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

exports.operation = async (req, res) => {
  try {
    const totalTransaction = await Transaction.count({ isDeleted: false })
    const totalReservation = await Reservation.count({ isCompleted: false })
    const totalStock = await ProductStock.count()
    const totalPromotion = await Promotion.count({ isDeleted: false })

    const transactions = await Transaction.find({ isDeleted: false }).select(
      'status'
    )
    let transactionPending = 0
    let transactionComplete = 0
    transactions.forEach((item) => {
      if (item.status) return (transactionComplete += 1)
      else transactionPending += 1
    })
    const transactionData = [
      {
        id: 'completed',
        name: 'Completed',
        value: transactionComplete,
        title: 'Transaction',
      },
      {
        id: 'pending',
        name: 'Pending',
        value: transactionPending,
        title: 'Transaction',
      },
    ]

    const reservations = await StoreStructure.find({
      isDisabled: false,
    }).select('status')
    let reserved = 0
    let vacant = 0
    let occupied = 0
    reservations.forEach((item) => {
      switch (item.status) {
        case 'reserved':
          reserved += 1
          break
        case 'occupied':
          occupied += 1
          break
        default:
          vacant += 1
          break
      }
    })
    const reservationData = [
      {
        id: 'reserved',
        name: 'Reserved',
        value: reserved,
        title: 'Reservation',
      },
      {
        id: 'occupied',
        name: 'Occupied',
        value: occupied,
        title: 'Reservation',
      },
      {
        id: 'vacant',
        name: 'Vacant',
        value: vacant,
        title: 'Reservation',
      },
    ]

    const stocks = await ProductStock.find().select('remain alertAt')
    let remain = 0
    let alert = 0
    let outOfStock = 0
    stocks.forEach((item) => {
      switch (true) {
        case item.quantity <= 0:
          outOfStock += 1
          break
        case item.quantity <= item.alertAt:
          alert += 1
          break
        default:
          remain += 1
          break
      }
    })
    const stockData = [
      {
        id: 'remain',
        name: 'Remain',
        value: remain,
        title: 'Stock',
      },
      {
        id: 'alert',
        name: 'Alert',
        value: alert,
        title: 'Stock',
      },
      {
        id: 'outOfStock',
        name: 'Out Of Stock',
        value: outOfStock,
        title: 'Stock',
      },
    ]

    const promotions = await Promotion.find({ isDeleted: false }).select(
      'expireAt'
    )
    let expire = 0
    let active = 0
    promotions.forEach((item) => {
      switch (true) {
        case !compareDate(Date.now(), new Date(item.expireAt)):
          active += 1
          break
        default:
          expire += 1
          break
      }
    })
    const promotionData = [
      {
        id: 'expire',
        name: 'Expire',
        value: expire,
        title: 'Promotion',
      },
      {
        id: 'active',
        name: 'Active',
        value: active,
        title: 'Promotion',
      },
    ]

    return response.success(
      200,
      {
        data: {
          totalTransaction,
          totalReservation,
          totalStock,
          totalPromotion,
          transactions: transactionData,
          reservations: reservationData,
          stocks: stockData,
          promotions: promotionData,
        },
      },
      res
    )
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}

// Function dashboard: customers, promotions, banners and Pay Later. Each part
// is only included for users allowed to see it.
exports.function = async (req, res) => {
  try {
    const privilege = req.user?.role?.privilege || {}
    const now = new Date()
    const data = {}

    if (privilege.function?.customer) {
      const live = { isDeleted: { $ne: true } }
      const [totalCustomer, byTier, byType, tiers] = await Promise.all([
        Customer.countDocuments(live),
        Customer.aggregate([{ $match: live }, { $group: { _id: '$tier', value: { $sum: 1 } } }]),
        Customer.aggregate([{ $match: live }, { $group: { _id: '$type', value: { $sum: 1 } } }]),
        CustomerTier.find({ isDeleted: { $ne: true } }).select('name color minSpent').sort({ minSpent: 1 }).lean(),
      ])
      const count = new Map(byTier.map((item) => [String(item._id), item.value]))
      // In tier order, then customers without a tier (or a deleted one)
      const tierData = tiers.map((tier) => ({ id: String(tier._id), name: tier.name, color: tier.color, value: count.get(String(tier._id)) || 0 }))
      const noTier = totalCustomer - tierData.reduce((sum, tier) => sum + tier.value, 0)
      if (noTier > 0) tierData.push({ id: 'none', name: null, value: noTier })
      data.totalCustomer = totalCustomer
      data.customerTiers = tierData.filter((tier) => tier.value > 0)
      const business = byType.find((item) => item._id === 'BUSINESS')?.value || 0
      data.customerTypes = [
        { id: 'INDIVIDUAL', value: totalCustomer - business },
        { id: 'BUSINESS', value: business },
      ].filter((item) => item.value > 0)
    }

    if (privilege.function?.promotion) {
      const live = { isDeleted: { $ne: true } }
      const [active, scheduled, expired] = await Promise.all([
        Promotion.countDocuments({ ...live, startAt: { $lte: now }, expireAt: { $gt: now } }),
        Promotion.countDocuments({ ...live, startAt: { $gt: now } }),
        Promotion.countDocuments({ ...live, expireAt: { $lte: now } }),
      ])
      data.activePromotion = active
      data.promotions = [
        { id: 'ACTIVE', value: active },
        { id: 'SCHEDULED', value: scheduled },
        { id: 'EXPIRED', value: expired },
      ].filter((item) => item.value > 0)
    }

    if (privilege.function?.banner) {
      // Showing: switched on, started (or no start set) and not ended
      data.activeBanner = await Announcement.countDocuments({
        isDeleted: { $ne: true },
        status: true,
        $or: [{ startAt: { $lte: now } }, { startAt: null }],
        expireAt: { $gt: now },
      })
    }

    if (privilege.operation?.payment) {
      const owing = await Payment.find({ isPayLater: true, 'balance.USD': { $gt: 0.01 } })
        .select('balance.USD payLater.dueDate customer')
        .lean()
      const sum = (list) => Math.round(list.reduce((total, payment) => total + (payment.balance?.USD || 0), 0) * 100) / 100
      const overdue = owing.filter((payment) => payment.payLater?.dueDate && new Date(payment.payLater.dueDate) < now)
      const notDue = owing.filter((payment) => !overdue.includes(payment))
      data.payLaterOwing = sum(owing)
      data.payLater = [
        { id: 'NOT_DUE', value: notDue.length, amount: sum(notDue) },
        { id: 'OVERDUE', value: overdue.length, amount: sum(overdue) },
      ].filter((item) => item.value > 0)
    }

    // Customers with a Pay Later balance (the card opens the customer list
    // filtered to them), and how many of them are overdue
    if (privilege.operation?.payment && privilege.function?.customer) {
      const owing = await Payment.find({ isPayLater: true, status: true, 'balance.USD': { $gt: 0.01 }, customer: { $ne: null } })
        .select('customer payLater.dueDate')
        .populate({ path: 'customer', select: 'isDeleted' })
        .lean()
      const live = owing.filter((payment) => payment.customer && !payment.customer.isDeleted)
      data.dueCustomers = new Set(live.map((payment) => String(payment.customer._id))).size
      data.overdueCustomers = new Set(live
        .filter((payment) => payment.payLater?.dueDate && new Date(payment.payLater.dueDate) < now)
        .map((payment) => String(payment.customer._id))).size
    }

    return response.success(200, { data }, res)
  } catch (err) {
    return response.failure(422, { msg: failureMsg.trouble }, res, err)
  }
}
