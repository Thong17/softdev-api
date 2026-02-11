const path = require('path')
const multer = require('multer')
const Minio = require('minio')
const multerMinio = require('multer-minio-storage-engine')

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST,
    port: Number(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
})

const storage = multerMinio({
    minio: minioClient,
    bucketName: process.env.MINIO_BUCKET,
    metaData: function (_req, file, cb) {
        try {
            cb(null, { mimetype: file.mimetype })
        } catch (error) {
            cb(error)
        }
    },
    objectName: function (_req, file, cb) {
        try {
            const name = Date.now().toString() + path.extname(file.originalname)
            cb(null, name)
        } catch (error) {
            cb(error)
        }
    },
})

module.exports = {
    minioStorage: multer({
        storage,
        limits: {
            fileSize: 5000000,
            fieldSize: 100 * 1024 * 1024
        },
        fileFilter: (_req, _file, cb) => {
            cb(null, true)
        }
    }),
    memoryStorage: multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 500000,
            fieldSize: 10 * 1024 * 1024
        },
        fileFilter: (_req, _file, cb) => {
            cb(null, true)
        }
    }),
    minioClient
}
