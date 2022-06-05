const router = require('express').Router()
const { list } = require('../../controllers/roleController')
const { uploadImage } = require('../../controllers/sharedController')
const multer = require('multer')
const security = require('../../middleware/security/index')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${file.originalname}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1000 * 1000 },
})

router.get('/role/list', (req, res) => {
  list(req, res)
})

router.post('/upload/image', upload.single('image'), (req, res) => {
  uploadImage(req, res)
})

module.exports = router
