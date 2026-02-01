const { reverseProductStock } = require('../../helpers/utils')
const Transaction = require('../../models/Transaction')

exports.clearPendingTransaction = () => {
    return async (req, res, next) => {
        try {
            const pendingTransaction = await Transaction.find({ status: false, isDeleted: false })
            if (pendingTransaction.length > 0) {
                pendingTransaction.forEach(transaction => {
                    reverseProductStock(transaction?.stocks)
                        .then(async () => {
                            await Transaction.findByIdAndUpdate(transaction._id, { isDeleted: true })
                        })
                        .catch(err => console.error(err))
                })
            }
            next()
        } catch (err) {
            console.error(err)
        }
    }
}