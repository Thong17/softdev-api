const router = require('express').Router()
const { minioClient } = require('../configs/multer')
const response = require('../helpers/response')

router.get('/uploads/:filename', async (req, res) => {
    try {
        let filename = req.params.filename ?? 'default.png'
        let bucketName = req.query.bucket ?? process.env.MINIO_BUCKET
        let mimetype = req.query.mimetype ?? 'image/jpeg'
        if (['null', 'undefined'].includes(filename)) filename = 'default.png'
        if (['null', 'undefined'].includes(bucketName)) bucketName = process.env.MINIO_BUCKET
        if (['null', 'undefined'].includes(mimetype)) mimetype = 'image/jpeg'
        const stream = await minioClient.getObject(bucketName, filename)
        res.set('Content-Type', mimetype)
        stream.pipe(res)
    } catch (error) {
        response.failure(422, { msg: error.message }, res, error)
    }
})

router.use('/auth', require('./auth/auth'))
router.use('/config', require('./config'))
router.use(require('../middleware/security').auth)
router.use('/shared', require('./shared'))
router.use('/admin', require('./admin'))
router.use('/organize', require('./organize'))
router.use('/sale', require('./sale'))
router.use('/function', require('./function'))
router.use('/user', require('./user'))
router.use('/report', require('./report'))
router.use('/dashboard', require('./dashboard'))

module.exports = router