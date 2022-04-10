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
    }
}

const roles = Object.keys(this.privilege)

let role
roles.forEach(p => {
    role = {
        ...role,
        [p]: {
            list: false,
            detail: false,
            create: false,
            update: false,
            delete: false
        }
    }
})

exports.preRole = role

