exports.privilege = {
    admin: {
        list: {
            route: 'admin',
            action: 'list'
        },
        detail: {
            route: 'admin',
            action: 'detail'
        },
        create: {
            route: 'admin',
            action: 'create'
        },
        update: {
            route: 'admin',
            action: 'update'
        },
        delete: {
            route: 'admin',
            action: 'delete'
        }
    },
    user: {
        list: {
            route: 'user',
            action: 'list'
        },
        detail: {
            route: 'user',
            action: 'detail'
        },
        create: {
            route: 'user',
            action: 'create'
        },
        update: {
            route: 'user',
            action: 'update'
        },
        delete: {
            route: 'user',
            action: 'delete'
        }
    },
    role: {
        list: {
            route: 'role',
            action: 'list'
        },
        detail: {
            route: 'role',
            action: 'detail'
        },
        create: {
            route: 'role',
            action: 'create'
        },
        update: {
            route: 'role',
            action: 'update'
        },
        delete: {
            route: 'role',
            action: 'delete'
        }
    },
    category: {
        list: {
            route: 'category',
            action: 'list'
        },
        detail: {
            route: 'category',
            action: 'detail'
        },
        create: {
            route: 'category',
            action: 'create'
        },
        update: {
            route: 'category',
            action: 'update'
        },
        delete: {
            route: 'category',
            action: 'delete'
        },
        approve: {
            route: 'category',
            action: 'approve'
        }
    },
    brand: {
        list: {
            route: 'brand',
            action: 'list'
        },
        detail: {
            route: 'brand',
            action: 'detail'
        },
        create: {
            route: 'brand',
            action: 'create'
        },
        update: {
            route: 'brand',
            action: 'update'
        },
        delete: {
            route: 'brand',
            action: 'delete'
        },
        approve: {
            route: 'brand',
            action: 'approve'
        }
    },
    product: {
        list: {
            route: 'product',
            action: 'list'
        },
        detail: {
            route: 'product',
            action: 'detail'
        },
        create: {
            route: 'product',
            action: 'create'
        },
        update: {
            route: 'product',
            action: 'update'
        },
        delete: {
            route: 'product',
            action: 'delete'
        },
        approve: {
            route: 'product',
            action: 'approve'
        }
    }
}

let role
const roles = Object.keys(this.privilege)
roles.forEach(p => {
    role = {
        ...role,
        [p]: {}
    }
    Object.keys(this.privilege[p]).forEach(k => {
        role[p][k] = false
    })
})

exports.preRole = role

