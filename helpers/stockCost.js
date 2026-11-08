// Stock (cost) prices are only for roles with product.viewCost. Product
// responses used by cashing populate `stocks`, so the cost is removed there for
// everyone else.
const canViewCost = (user) => !!user?.role?.privilege?.product?.viewCost

const withoutStockCost = (product) => {
    if (!product?.stocks?.length) return product
    const data = product.toObject ? product.toObject() : { ...product }
    data.stocks = data.stocks.map((stock) => {
        if (!stock || typeof stock !== 'object') return stock
        const { cost, ...rest } = stock
        return rest
    })
    return data
}

// Applies withoutStockCost unless the user may see costs
const stockCostFor = (user) => (product) => canViewCost(user) ? product : withoutStockCost(product)

module.exports = { canViewCost, withoutStockCost, stockCostFor }
