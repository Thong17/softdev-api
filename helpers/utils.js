const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { default: mongoose } = require('mongoose')
const responseMsg = require('../constants/responseMsg')
const ProductStock = require('../models/ProductStock')
const Product = require('../models/Product')

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
    },
    compareDate: (date1, date2) => {
        if (!date1 && !date2) return false
        return date1 > date2
    },
    readExcel: (buffer, field) => {
        const xlsx = require('xlsx')
        const ObjectId = mongoose.Types.ObjectId
        return new Promise((resolve, reject) => {
            try {
                const fields = field.split(',')
                const workbook = xlsx.read(buffer, { type: 'buffer' })
                const json = xlsx.utils.sheet_to_json(workbook.Sheets?.['Sheet1'] || {})
                const data = []
                let no = 0
                json.forEach(row => {
                    let obj = {}
                    no++
                    fields.forEach(column => {
                        let value = row?.[column]
                        if (!value) return
                        if (column === '_id') value = new ObjectId(value)

                        obj = {
                            ...obj,
                            no: no,
                            [column]: value
                        }
                    })
                    Object.keys(obj).length > 0 && data.push(obj) 
                })
                if (data.length === 0) reject({ msg: 'Invalid excel format!', code: 422 })
                resolve(data)
            } catch (err) {
                reject({ msg: responseMsg.failureMsg.trouble, code: 422 })
            }
        })
    },
    calculatePromotion: (totalObj, discountObj, exchangeRate) => {
        if (discountObj.isFixed) {
            if (discountObj.type !== 'PCT') {
                totalObj.total = discountObj.value
                totalObj.currency = discountObj.type
                return totalObj
            }
            totalObj.total = (totalObj.total * discountObj.value) / 100
            totalObj.currency = discountObj.type
            return totalObj
        }

        if (discountObj.type === 'PCT') {
            totalObj.total = totalObj.total - (totalObj.total * discountObj.value / 100)
            return totalObj
        }

        const { sellRate = 4000, buyRate = 4100 } = exchangeRate
        if (totalObj.currency === discountObj.type) {
            totalObj.total = totalObj.total - discountObj.value
            return totalObj
        }

        let totalExchange = 0
        if (discountObj.type === 'USD') {
            totalExchange = discountObj.value * sellRate
            totalObj.total = totalObj.total - totalExchange
        } else {
            totalExchange = discountObj.value / buyRate
            totalObj.total = totalObj.total - totalExchange
        }
        return totalObj
    },
    calculateService: (totalObj, serviceObj, exchangeRate) => {
        if (serviceObj.type === 'PCT') {
            totalObj.total = totalObj.total + (totalObj.total * serviceObj.value / 100)
            return totalObj
        }

        const { sellRate = 4000, buyRate = 4100 } = exchangeRate
        if (totalObj.currency === serviceObj.type) {
            totalObj.total = totalObj.total + serviceObj.value
            return totalObj
        }

        let totalExchange = 0
        if (serviceObj.type === 'USD') {
            totalExchange = serviceObj.value * sellRate
            totalObj.total = totalObj.total + totalExchange
        } else {
            totalExchange = serviceObj.value / buyRate
            totalObj.total = totalObj.total + totalExchange
        }
        return totalObj
    },
    determineProductStock: async (product, color, options, quantity) => {
        var transactionId = mongoose.Types.ObjectId()
        const result = await Product.findById(product).select('isStock')
        if (!result || !result.isStock) return { isValid: true, transactionId, orderStocks: [], stockCosts: [] }

        let filter = { product }
        if (options.length > 0) filter['options'] = { '$in': options }
        if (color) filter['color'] = color

        let orderQuantity = quantity
        let orderStocks = []

        const stocks = await ProductStock.find(filter)
        let totalStock = 0
        let stockCosts = []
        stocks.forEach(stock => {
            totalStock += stock.quantity
        })
        if (totalStock < orderQuantity) return { isValid: false, msg: 'Product quantity has exceed our current stock' }

        for (let index = 0; index < stocks.length; index++) {
            const stock = stocks[index]
            let remainQuantity = stock.quantity

            if (orderQuantity < 1) break
            if (stock.quantity < 1) continue
            if (orderQuantity > stock.quantity) {
                orderStocks.push({ id: stock._id, quantity: stock.quantity })
                stockCosts.push({ cost: stock.cost * stock.quantity, currency: stock.currency })
                orderQuantity -= stock.quantity
                remainQuantity = 0
            } else {
                orderStocks.push({ id: stock._id, quantity: orderQuantity })
                stockCosts.push({ cost: stock.cost * orderQuantity, currency: stock.currency })
                remainQuantity -= orderQuantity
                orderQuantity = 0
            }
            
            await ProductStock.findByIdAndUpdate(stock._id, { quantity: remainQuantity, transactions: [...stock.transactions, transactionId] })
        }
        return { isValid: true, transactionId, orderStocks, stockCosts }
    },
    reverseProductStock: (stocks) => {
        return new Promise(async (resolve, reject) => {
            if (!stocks) reject({ msg: responseMsg.failureMsg.trouble, code: 422 })
            try {
                for (let index = 0; index < stocks.length; index++) {
                    const transactionStock = stocks[index]
                    const stock = await ProductStock.findById(transactionStock.id)
                    await ProductStock.findByIdAndUpdate(transactionStock.id, { quantity: stock.quantity + transactionStock.quantity })
                }
                resolve()
            } catch (err) {
                reject({ msg: responseMsg.failureMsg.trouble, code: 422 })
            }
        })
    },
    calculatePaymentTotal: (transactions, services, vouchers, discounts, exchangeRate) => {
        const { sellRate } = exchangeRate
        let totalUSD = 0
        let totalKHR = 0

        transactions.forEach(transaction => {
            if (transaction.total?.currency === 'USD') totalUSD += transaction.total?.value
            else totalKHR += transaction.total?.value
        })

        const totalBoth = totalUSD + (totalKHR / sellRate)

        let total = totalBoth
        let currency = 'USD'

        discounts.forEach(promotion => {
            if (currency === 'KHR') {
                total /= sellRate
                currency = 'USD'
            }

            let { total: totalDiscounted, currency: currencyDiscounted } = utils.calculatePromotion({ total, currency }, promotion, exchangeRate)

            total = totalDiscounted
            currency = currencyDiscounted
        })

        services.forEach(service => {
            if (currency === 'KHR') {
                total /= sellRate
                currency = 'USD'
            }
            
            let { total: totalCharged, currency: currencyCharged } = utils.calculateService({ total, currency }, service, exchangeRate)

            total = totalCharged
            currency = currencyCharged
        })

        vouchers.forEach(promotion => {
            if (currency === 'KHR') {
                total /= sellRate
                currency = 'USD'
            }

            let { total: totalVouchered, currency: currencyVouchered } = utils.calculatePromotion({ total, currency }, promotion, exchangeRate)

            total = totalVouchered
            currency = currencyVouchered
        })

        return { total: { value: total, currency }, subtotal: { USD: totalUSD, KHR: totalKHR, BOTH: totalBoth }, rate: exchangeRate }
    },
    sortObject: (array, property) => {
        return array.sort((a, b) => (a[property] > b[property]) ? 1 : ((b[property] > a[property]) ? -1 : 0))
    },
    calculateReturnCashes: (cashes, remainTotal, exchangeRate) => {
        return new Promise((resolve, reject) => {
            if (remainTotal.USD >= 0) reject({ msg: 'No return cash', code: 422 })

            const { sellRate } = exchangeRate
            let returnCash = Math.abs(remainTotal.USD)
            let returnCashes = []

            const mappedCashes = cashes.map(cash => {
                return cash.currency === 'USD' 
                    ? ({ ...cash, value: parseFloat(cash.cash) }) 
                    : ({ ...cash, value: parseFloat(cash.cash) / sellRate })
            })
            const sortedCashes = utils.sortObject(mappedCashes, 'value')

            sortedCashes.reverse().forEach(cash => {
                if (returnCash / cash.value < 1 || cash.quantity < 1 || returnCash <= 0) return
                let needQuantity = Math.floor(returnCash / cash.value)
                const quantity = parseFloat(cash.quantity)

                if (quantity > needQuantity) {
                    returnCashes.push({ cash: cash.cash, quantity: needQuantity, currency: cash.currency, rate: sellRate })
                    returnCash -= cash.value * needQuantity
                    cash.quantity = quantity - needQuantity
                } else {
                    returnCashes.push({ cash: cash.cash, quantity, currency: cash.currency, rate: sellRate })
                    returnCash -= cash.value * quantity
                    cash.quantity = 0
                }
            })

            if (returnCash > 0) returnCashes.push({ cash: returnCash, exchange: returnCash * sellRate, currency: 'USD', rate: sellRate, quantity: 1 })

            resolve({ remainCash: -returnCash, returnCashes, cashes: sortedCashes })
        })
    },
}