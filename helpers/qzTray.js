const qz = require('qz-tray')
const WebSocket = require('ws')
const jsrsasign = require('jsrsasign')
const crypto = require('node:crypto')
const fs = require('node:fs')

// QZ Tray runs on the machine the printers are attached to. The API talks to it
// directly so any device on the network can print through the API instead of
// needing its own QZ Tray install. When the API runs in Docker on that machine,
// set QZ_TRAY_HOST=host.docker.internal.
const QZ_TRAY_HOST = process.env.QZ_TRAY_HOST || 'localhost'

qz.api.setWebSocketType(WebSocket)
qz.api.setPromiseType((resolver) => new Promise(resolver))
qz.api.setSha256Type((data) => crypto.createHash('sha256').update(data).digest('hex'))

const readFile = (filePath) => {
    if (!filePath) throw new Error('QZ Tray certificate/private key path is not configured')
    return fs.readFileSync(filePath, 'utf-8')
}

// Also used by the browser in `web` print mode, so the private key never leaves the API
const getCertificate = () => readFile(process.env.QZ_TRAY_CERTIFICATE_PATH).trim()

const sign = (toSign) => {
    const pk = jsrsasign.KEYUTIL.getKey(readFile(process.env.QZ_TRAY_PRIVATE_KEY_PATH))
    const sig = new jsrsasign.KJUR.crypto.Signature({ alg: 'SHA512withRSA' })
    sig.init(pk)
    sig.updateString(toSign)
    return jsrsasign.stob64(jsrsasign.hextorstr(sig.sign()))
}

qz.security.setCertificatePromise((resolve, reject) => {
    try {
        resolve(getCertificate())
    } catch (err) {
        reject(err)
    }
})

qz.security.setSignatureAlgorithm('SHA512')
qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    try {
        resolve(sign(toSign))
    } catch (err) {
        reject(err)
    }
})

let connecting = null

const connect = async () => {
    if (qz.websocket.isActive()) return
    if (!connecting) {
        connecting = qz.websocket
            .connect({ host: QZ_TRAY_HOST, usingSecure: false, retries: 2, delay: 1 })
            .finally(() => { connecting = null })
    }
    await connecting
}

// Print jobs from different devices are serialized so labels/receipts from
// concurrent requests never interleave on the same printer.
let queue = Promise.resolve()

const print = (printer, data, options = {}) => {
    if (!printer) return Promise.reject(new Error('Printer name is not configured'))
    const job = queue.then(async () => {
        await connect()
        const config = qz.configs.create(printer, options)
        for (const chunk of data) {
            await qz.print(config, [chunk])
        }
    })
    queue = job.catch(() => {})
    return job
}

const status = async () => {
    await connect()
    const printers = await qz.printers.find()
    return { connected: true, host: QZ_TRAY_HOST, printers }
}

module.exports = { print, status, getCertificate, sign }
