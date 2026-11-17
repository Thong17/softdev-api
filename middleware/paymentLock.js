const response = require('../helpers/response')

// Payments with a checkout or collection running right now. The server runs as
// one process, so this set sees every request.
const busy = new Set()

// One money-changing request per payment at a time. Without it, two clicks close
// together both pass the "already checked out" check before either saves, so the
// sale is checked out twice (cash into the drawer twice, two deposits).
// The lock is released when the response finishes or the connection closes.
const paymentLock = (req, res, next) => {
    const id = String(req.params.id || '')
    if (!id) return next()
    if (busy.has(id)) return response.failure(422, { msg: 'This payment is already being processed' }, res)
    busy.add(id)
    let released = false
    const release = () => {
        if (released) return
        released = true
        busy.delete(id)
    }
    res.on('finish', release)
    res.on('close', release)
    next()
}

module.exports = paymentLock
